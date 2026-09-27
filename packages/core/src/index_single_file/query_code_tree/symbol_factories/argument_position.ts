/**
 * Where a callback sits among the arguments of the call it is passed to.
 */

import type { SyntaxNode } from "tree-sitter";

/**
 * The position `callback` takes among the arguments `arguments_node` lists, or
 * null when it is not one of them itself — written inside a wrapping
 * expression, or passed by keyword — so no declared parameter position is its.
 * Parentheses hand on the value they wrap, so `call((|x| x))` passes the
 * closure at position 0.
 */
export function argument_position(arguments_node: SyntaxNode, callback: SyntaxNode): number | null {
  let argument = callback;
  while (argument.parent && argument.parent.id !== arguments_node.id) {
    if (!PARENTHESES.has(argument.parent.type)) {
      return null;
    }
    argument = argument.parent;
  }
  const index = arguments_node.namedChildren
    .filter((child) => !child.type.endsWith("comment"))
    .findIndex((child) => child.id === argument.id);
  return index < 0 ? null : index;
}

const PARENTHESES: ReadonlySet<string> = new Set(["parenthesized_expression"]);
