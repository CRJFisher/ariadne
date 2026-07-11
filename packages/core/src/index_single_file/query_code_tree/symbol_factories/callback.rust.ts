import type { SyntaxNode } from "tree-sitter";
import type { CallbackContext, FilePath } from "@ariadnejs/types";

/**
 * Determine whether a closure is passed as an argument to a function call.
 * The walk is bounded to MAX_DEPTH ancestors so a closure buried deep inside
 * unrelated expressions is not misattributed to a distant enclosing call.
 */
export function detect_callback_context(
  node: SyntaxNode,
  file_path: FilePath
): CallbackContext {
  let current: SyntaxNode | null = node.parent;
  let depth = 0;
  const MAX_DEPTH = 5;

  while (current && depth < MAX_DEPTH) {
    if (current.type === "arguments") {
      const call_node = current.parent;
      if (call_node && call_node.type === "call_expression") {
        return {
          is_callback: true,
          receiver_is_external: null,
          receiver_location: {
            file_path: file_path,
            start_line: call_node.startPosition.row + 1,
            start_column: call_node.startPosition.column + 1,
            end_line: call_node.endPosition.row + 1,
            end_column: call_node.endPosition.column,
          },
        };
      }
    }
    current = current.parent;
    depth++;
  }

  return {
    is_callback: false,
    receiver_is_external: null,
    receiver_location: null,
  };
}
