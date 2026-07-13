import type { CallSiteSyntax, ReceiverKind } from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";

/**
 * Python call-site syntax extraction, keyed to the Python grammar's node types
 * (`call`, `attribute`, `subscript`, …).
 */

/**
 * Identifier texts that denote a self-reference keyword. `this`/`super` are
 * kept alongside `self`/`cls` so a Python identifier spelled like a TS self
 * receiver classifies identically across languages.
 */
const SELF_KEYWORD_TEXTS: ReadonlySet<string> = new Set([
  "this",
  "super",
  "self",
  "cls",
]);

/**
 * Classify a method-call receiver node.
 *
 * Navigates one layer: for `call`, resolves to the `function` field; for
 * `attribute`, resolves to the `object` field. Returns undefined when the call
 * shape is unrecognized.
 */
function classify_receiver_node(node: SyntaxNode): SyntaxNode | undefined {
  let target = node;
  if (target.type === "call") {
    const function_node = target.childForFieldName("function");
    if (!function_node) return undefined;
    target = function_node;
  }

  if (target.type === "attribute") {
    const object_node = target.childForFieldName("object");
    if (!object_node) return undefined;
    return object_node;
  }

  return undefined;
}

/**
 * Classify receiver kind from the receiver node's AST shape.
 */
function receiver_kind_from_node(receiver: SyntaxNode): ReceiverKind {
  if (receiver.type === "parenthesized_expression") {
    return "parenthesized";
  }

  if (receiver.type === "identifier" && SELF_KEYWORD_TEXTS.has(receiver.text)) {
    return "self_keyword";
  }

  // `super().m()` — the receiver is a `call` whose function is `super`
  if (receiver.type === "call") {
    const fn = receiver.childForFieldName("function");
    if (fn && fn.type === "identifier" && fn.text === "super") {
      return "self_keyword";
    }
    return "call_chain";
  }

  if (receiver.type === "attribute") {
    return "member_expression";
  }

  if (receiver.type === "subscript") {
    return "index_access";
  }

  // Fallback: plain identifier (or any unclassified leaf)
  return "identifier";
}

/**
 * Classify a call-chain receiver's inner call target by lexical convention.
 *
 * Only meaningful for `ReceiverKind.call_chain`. A neutral AST observation
 * about the case shape of the inner call target; no type inference.
 *
 * Convention:
 * - inner call target is an identifier starting with uppercase → `class_like`
 * - inner call target is an identifier starting with lowercase → `function_like`
 * - anything else (non-identifier target, empty text) → `unknown`
 */
function call_chain_target_lexical_shape(
  receiver: SyntaxNode
): "class_like" | "function_like" | "unknown" {
  if (receiver.type !== "call") return "unknown";

  const fn = receiver.childForFieldName("function");
  if (!fn) return "unknown";
  if (fn.type !== "identifier") return "unknown";

  const first = fn.text[0];
  if (!first) return "unknown";
  if (first >= "A" && first <= "Z") return "class_like";
  if (first >= "a" && first <= "z") return "function_like";
  return "unknown";
}

/**
 * Check whether an index-access receiver uses a literal key.
 *
 * Only meaningful for `ReceiverKind.index_access`. Literal-key dispatch
 * (`a["k"].m()`, `a[0].m()`) is typically resolvable; non-literal dispatch
 * (`a[k].m()`) is F9.
 */
function index_key_literalness(receiver: SyntaxNode): boolean {
  if (receiver.type !== "subscript") return false;

  const key = receiver.childForFieldName("subscript");
  if (!key) return false;
  return (
    key.type === "string" || key.type === "integer" || key.type === "float"
  );
}

/**
 * Extract call-site syntactic context for a Python method call. Returns
 * undefined when the node is not a recognizable method call, leaving
 * downstream classifiers to treat the signal as missing.
 */
export function extract_call_site_syntax_python(
  node: SyntaxNode
): CallSiteSyntax | undefined {
  const receiver = classify_receiver_node(node);
  if (!receiver) return undefined;

  const receiver_kind = receiver_kind_from_node(receiver);

  if (receiver_kind === "call_chain") {
    return {
      receiver_kind,
      receiver_call_target_lexical_shape:
        call_chain_target_lexical_shape(receiver),
    };
  }

  if (receiver_kind === "index_access") {
    return {
      receiver_kind,
      index_key_is_literal: index_key_literalness(receiver),
    };
  }

  return { receiver_kind };
}
