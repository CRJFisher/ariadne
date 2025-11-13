import type { SyntaxNode } from "tree-sitter";
import type { CallbackContext } from "@ariadnejs/types";

/**
 * Detect if a closure is passed as a callback argument.
 * Walks up the AST to find if the closure is inside function call arguments.
 */
export function detect_callback_context(
  node: SyntaxNode,
  file_path: string
): CallbackContext {
  let current: SyntaxNode | null = node.parent;
  let depth = 0;
  const MAX_DEPTH = 5;

  while (current && depth < MAX_DEPTH) {
    // Rust uses 'arguments' for function call arguments
    if (current.type === "arguments") {
      const call_node = current.parent;
      // Rust uses 'call_expression' for function calls
      if (call_node && call_node.type === "call_expression") {
        return {
          is_callback: true,
          receiver_is_external: null,
          receiver_location: {
            file_path: file_path as any,
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
