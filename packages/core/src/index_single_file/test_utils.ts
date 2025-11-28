/**
 * Test utilities for semantic index tests
 */

import type { SyntaxNode } from "tree-sitter";

/**
 * Create a mock SyntaxNode for testing
 *
 * @param node_type - The type of the node (e.g., "identifier", "function_declaration")
 * @param text - The text content of the node
 * @param start_row - Starting row position (default: 0)
 * @param start_column - Starting column position (default: 0)
 * @param end_row - Ending row position (default: start_row)
 * @param end_column - Ending column position (default: start_column + text.length)
 * @param additional_props - Additional properties to override or add
 * @returns A mock SyntaxNode
 */
export function create_mock_node(
  node_type: string = "mock_node",
  text: string = "mock_text",
  start_row: number = 0,
  start_column: number = 0,
  end_row?: number,
  end_column?: number,
  additional_props: Partial<SyntaxNode> = {},
): SyntaxNode {
  const final_end_row = end_row ?? start_row;
  const final_end_column = end_column ?? start_column + text.length;

  return {
    text,
    type: node_type,
    startPosition: { row: start_row, column: start_column },
    endPosition: { row: final_end_row, column: final_end_column },
    children: [],
    parent: null,
    ...additional_props,
  } as unknown as SyntaxNode;
}

