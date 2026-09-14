/**
 * What a Rust `let`/`const` initialiser names: the collection it is looked up
 * from and the callee chain of the call it is initialised from. Resolution
 * follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/HashMap lookup.
 *
 * Patterns detected:
 * 1. let handler = config.get("key");  -> returns "config"
 * 2. let handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier") {
    assignment = node.parent || node;
  }

  // Handle let_declaration: let x = ...
  if (assignment.type === "let_declaration" || assignment.type === "const_item") {
    const value_node = assignment.childForFieldName?.("value");
    if (!value_node) return undefined;

    // Case 1: Method call (config.get(...))
    if (value_node.type === "call_expression") {
      const function_node = value_node.childForFieldName?.("function");
      if (function_node?.type === "field_expression") {
        const value = function_node.childForFieldName?.("value");
        const field = function_node.childForFieldName?.("field");
        
        if (value?.type === "identifier" && field?.text === "get") {
          return value.text as SymbolName;
        }
      }
    }

    // Case 2: Index access (config["key"])
    if (value_node.type === "index_expression") {
      let operand = value_node.childForFieldName?.("operand");
      if (!operand) {
        // Fallback to first child if field name is not available
        operand = value_node.child(0) || null;
      }

      if (operand?.type === "identifier") {
        return operand.text as SymbolName;
      }
    }
  }

  return undefined;
}

/**
 * The callee chain of a `let`/`const` call initialiser, root first:
 * `["has_flatten"]` for `let has_flatten = has_flatten(fields)`, `["s", "get_info"]`
 * for `let i = s.get_info()`, `["self", "inner", "get"]` for `let g =
 * self.inner.get()`. A `::` path (`Foo::new()`) is left to the constructor and
 * path resolvers, and a callee that is not a field chain rooted at an identifier
 * or `self` has no chain.
 */
export function extract_initializer_call(
  node: SyntaxNode
): readonly SymbolName[] | undefined {
  const assignment = node.type === "identifier" ? (node.parent ?? node) : node;
  if (assignment.type !== "let_declaration" && assignment.type !== "const_item") {
    return undefined;
  }

  const value_node = assignment.childForFieldName("value");
  if (value_node?.type !== "call_expression") {
    return undefined;
  }

  let function_node = value_node.childForFieldName("function");
  // Turbofish `x::<T>()` wraps the callee in a generic_function; the chain is its
  // `function` child.
  if (function_node?.type === "generic_function") {
    function_node = function_node.childForFieldName("function");
  }
  return function_node ? field_chain(function_node) : undefined;
}

function field_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier" || node.type === "self") {
    return [node.text as SymbolName];
  }
  if (node.type !== "field_expression") {
    return undefined;
  }
  const value_node = node.childForFieldName("value");
  const field_node = node.childForFieldName("field");
  if (!value_node || field_node?.type !== "field_identifier") {
    return undefined;
  }
  const root = field_chain(value_node);
  return root ? [...root, field_node.text as SymbolName] : undefined;
}
