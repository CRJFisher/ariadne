/**
 * What a Python variable's initialiser names: the collection it
 * is looked up from, the member it reads, and the callee chain of the call it
 * is initialised from. Resolution follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/Dict lookup.
 *
 * Patterns detected:
 * 1. handler = config.get("key")  -> returns "config"
 * 2. handler = config["key"]      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier" || node.type === "attribute") {
    assignment = node.parent || node;
  }

  if (assignment.type !== "assignment") {
    // Try to find parent assignment
    let current = node.parent;
    while (current) {
      if (current.type === "assignment") {
        assignment = current;
        break;
      }
      current = current.parent;
    }
  }

  if (assignment.type !== "assignment") {
    return undefined;
  }

  const value_node = assignment.childForFieldName?.("right");
  if (!value_node) {
    return undefined;
  }

  // Case 1: Method call (config.get(...))
  if (value_node.type === "call") {
    const function_node = value_node.childForFieldName?.("function");
    if (function_node?.type === "attribute") {
      const object_node = function_node.childForFieldName?.("object");
      const attribute_node = function_node.childForFieldName?.("attribute");

      if (object_node?.type === "identifier" && attribute_node?.text === "get") {
        return object_node.text as SymbolName;
      }
    }
  }

  // Case 2: Subscript access (config[...])
  if (value_node.type === "subscript") {
    const value = value_node.childForFieldName?.("value");
    if (value?.type === "identifier") {
      return value.text as SymbolName;
    }
  }

  return undefined;
}

/**
 * The callee chain of a plain `name = call(...)` initialiser, root first:
 * `["connect"]` for `c = connect()`, `["s", "get_info"]` for `i = s.get_info()`,
 * `["self", "factory"]` for `p = self.factory()`. A callee that is not an
 * attribute chain rooted at an identifier (`make()(…)`, `table[k]()`) has no
 * chain, and neither does a target that is not the bare name the assignment
 * binds (`a, b = f()`).
 */
export function extract_initializer_call(node: SyntaxNode): readonly SymbolName[] | undefined {
  const value_node = bound_value(node);
  if (value_node?.type !== "call") {
    return undefined;
  }
  const function_node = value_node.childForFieldName("function");
  return function_node ? attribute_chain(function_node) : undefined;
}

/**
 * The holder and member a plain attribute-read initialiser names:
 * `orig = BaseTask.__call__` → `{ holder: "BaseTask", member: "__call__" }`.
 */
export function extract_member_source(
  node: SyntaxNode
): { holder: SymbolName; member: SymbolName } | undefined {
  const value_node = bound_value(node);
  if (value_node?.type !== "attribute") {
    return undefined;
  }
  const holder_node = value_node.childForFieldName("object");
  const member_node = value_node.childForFieldName("attribute");
  if (holder_node?.type !== "identifier" || !member_node) {
    return undefined;
  }
  return { holder: holder_node.text as SymbolName, member: member_node.text as SymbolName };
}

/** The right-hand side of the assignment whose left side is exactly `node`. */
function bound_value(node: SyntaxNode): SyntaxNode | null {
  const assignment = node.parent;
  if (assignment?.type !== "assignment" || assignment.childForFieldName("left")?.id !== node.id) {
    return null;
  }
  return assignment.childForFieldName("right");
}

function attribute_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier") {
    return [node.text as SymbolName];
  }
  if (node.type !== "attribute") {
    return undefined;
  }
  const object_node = node.childForFieldName("object");
  const attribute_node = node.childForFieldName("attribute");
  if (!object_node || !attribute_node) {
    return undefined;
  }
  const root = attribute_chain(object_node);
  return root ? [...root, attribute_node.text as SymbolName] : undefined;
}
