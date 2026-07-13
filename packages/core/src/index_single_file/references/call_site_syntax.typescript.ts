import type { CallSiteSyntax, ReceiverKind } from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";

/**
 * TS/JS call-site syntax extraction, keyed to the TypeScript grammar's node
 * types (`call_expression`, `member_expression`, `subscript_expression`, …).
 * JavaScript shares the grammar, so both languages route here.
 */

/**
 * Identifier texts that denote a self-reference keyword. `self`/`cls` are kept
 * alongside `this`/`super` so a TS identifier spelled like a Python self
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
 * Navigates one layer: for `call_expression`, resolves to the `function`
 * field; for `member_expression` / `optional_chain`, resolves to the `object`
 * field. Returns undefined when the call shape is unrecognized.
 */
function classify_receiver_node(node: SyntaxNode): SyntaxNode | undefined {
  let target = node;
  if (target.type === "call_expression") {
    const function_node = target.childForFieldName("function");
    if (!function_node) return undefined;
    target = function_node;
  }

  if (
    target.type === "member_expression" ||
    target.type === "optional_chain"
  ) {
    const object_node = target.childForFieldName("object");
    if (!object_node) return undefined;
    return object_node;
  }

  return undefined;
}

/**
 * Classify receiver kind from the receiver node's AST shape.
 *
 * Unwraps all layers of parentheses to detect an inner `type_cast` (as-expression
 * or satisfies-expression) — `(x as T).m()` and `(((x as T))).m()` both return
 * `type_cast`, while `(complex_expr).m()` returns `parenthesized`.
 */
function receiver_kind_from_node(receiver: SyntaxNode): ReceiverKind {
  if (
    receiver.type === "as_expression" ||
    receiver.type === "satisfies_expression"
  ) {
    return "type_cast";
  }

  if (receiver.type === "parenthesized_expression") {
    let inner: SyntaxNode | undefined = receiver;
    while (inner && inner.type === "parenthesized_expression") {
      let next: SyntaxNode | undefined = undefined;
      for (let i = 0; i < inner.namedChildCount; i++) {
        const child = inner.namedChild(i);
        if (child) {
          next = child;
          break;
        }
      }
      inner = next;
    }
    if (
      inner &&
      (inner.type === "as_expression" || inner.type === "satisfies_expression")
    ) {
      return "type_cast";
    }
    return "parenthesized";
  }

  if (receiver.type === "non_null_expression") {
    return "non_null_assertion";
  }

  if (receiver.type === "this" || receiver.type === "super") {
    return "self_keyword";
  }
  if (receiver.type === "identifier" && SELF_KEYWORD_TEXTS.has(receiver.text)) {
    return "self_keyword";
  }

  // `new Foo().m()` — construct expression feeding a method call; semantically F3
  if (receiver.type === "new_expression") {
    return "call_chain";
  }

  if (receiver.type === "call_expression") {
    return "call_chain";
  }

  if (
    receiver.type === "member_expression" ||
    receiver.type === "optional_chain"
  ) {
    return "member_expression";
  }

  if (receiver.type === "subscript_expression") {
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
 * - inner call target is identifier/type_identifier starting with uppercase → `class_like`
 * - inner call target is identifier starting with lowercase → `function_like`
 * - anything else (non-identifier target, empty text) → `unknown`
 */
function call_chain_target_lexical_shape(
  receiver: SyntaxNode
): "class_like" | "function_like" | "unknown" {
  // `new Foo()` — always a constructor → class_like
  if (receiver.type === "new_expression") return "class_like";

  if (receiver.type !== "call_expression") return "unknown";

  const fn = receiver.childForFieldName("function");
  if (!fn) return "unknown";
  if (fn.type !== "identifier" && fn.type !== "type_identifier") {
    return "unknown";
  }

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
  if (receiver.type !== "subscript_expression") return false;

  const index = receiver.childForFieldName("index");
  if (!index) return false;
  return index.type === "string" || index.type === "number";
}

/**
 * Extract call-site syntactic context for a TS/JS method call. Returns
 * undefined when the node is not a recognizable method call, leaving
 * downstream classifiers to treat the signal as missing.
 */
export function extract_call_site_syntax_typescript(
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
