/**
 * What a JavaScript/TypeScript variable's initialiser names: the collection it
 * is looked up from, the member it reads, and the callee chain of the call it
 * is initialised from. Resolution follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/Array/Object lookup.
 *
 * Patterns detected:
 * 1. const handler = config.get("key");  -> returns "config"
 * 2. const handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  const value_node = declarator_value(node);
  if (!value_node) {
    return undefined;
  }

  // Case 1: Method call (config.get(...))
  if (value_node.type === "call_expression") {
    const function_node = value_node.childForFieldName("function");
    if (function_node?.type === "member_expression") {
      const object_node = function_node.childForFieldName("object");
      if (object_node?.type === "identifier") {
        return object_node.text as SymbolName;
      }
    }
  }

  // Case 2: Member access (config[...])
  if (value_node.type === "member_expression" || value_node.type === "subscript_expression") {
    const object_node = value_node.childForFieldName("object");
    if (object_node?.type === "identifier") {
      return object_node.text as SymbolName;
    }
  }

  return undefined;
}

/**
 * The callee chain of a declarator's call initialiser, root first:
 * `["get_scope_boundary_extractor"]` for `const e = get_scope_boundary_extractor()`,
 * `["s", "getInfo"]` for `const i = s.getInfo()`, `["this", "#tm", "get"]` for
 * `const t = this.#tm.get()`. A callee that is not a name chain rooted at an
 * identifier or `this` (`make()()`, `a[k]()`, `super.f()`) has no chain.
 */
export function extract_initializer_call(node: SyntaxNode): readonly SymbolName[] | undefined {
  const value_node = declarator_value(node);
  if (value_node?.type !== "call_expression") {
    return undefined;
  }
  const function_node = value_node.childForFieldName("function");
  return function_node ? name_chain(function_node) : undefined;
}

/**
 * The holder and member a plain member-read initialiser names: `var alias = Ns.A`
 * → `{ holder: "Ns", member: "A" }`. A call, a subscript or a chain deeper than one
 * hop names no single member of a bare holder.
 */
export function extract_member_source(
  node: SyntaxNode
): { holder: SymbolName; member: SymbolName } | undefined {
  const value_node = declarator_value(node);
  if (value_node?.type !== "member_expression") {
    return undefined;
  }
  const holder_node = value_node.childForFieldName("object");
  const member_node = value_node.childForFieldName("property");
  if (holder_node?.type !== "identifier" || member_node?.type !== "property_identifier") {
    return undefined;
  }
  return { holder: holder_node.text as SymbolName, member: member_node.text as SymbolName };
}

function declarator_value(node: SyntaxNode): SyntaxNode | null {
  const declarator =
    node.type === "identifier" || node.type === "property_identifier"
      ? (node.parent ?? node)
      : node;
  return declarator.childForFieldName("value") ?? declarator.childForFieldName("init");
}

/**
 * A callee's names alone, root first. A receiver's `build_property_chain` also
 * carries call arguments and subscripts, which a name the type registry looks up
 * cannot hold, so a chain with either has no names here.
 */
function name_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier" || node.type === "this") {
    return [node.text as SymbolName];
  }
  if (node.type !== "member_expression") {
    return undefined;
  }
  const object_node = node.childForFieldName("object");
  const property_node = node.childForFieldName("property");
  if (
    !object_node ||
    (property_node?.type !== "property_identifier" &&
      property_node?.type !== "private_property_identifier")
  ) {
    return undefined;
  }
  const root = name_chain(object_node);
  return root ? [...root, property_node.text as SymbolName] : undefined;
}
