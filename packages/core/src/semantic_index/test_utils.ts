/**
 * Test utilities for semantic index tests
 */

import type { SyntaxNode } from "tree-sitter";

/**
 * Create a mock SyntaxNode for testing
 *
 * @param nodeType - The type of the node (e.g., "identifier", "function_declaration")
 * @param text - The text content of the node
 * @param startRow - Starting row position (default: 0)
 * @param startColumn - Starting column position (default: 0)
 * @param endRow - Ending row position (default: startRow)
 * @param endColumn - Ending column position (default: startColumn + text.length)
 * @param additionalProps - Additional properties to override or add
 * @returns A mock SyntaxNode
 */
export function create_mock_node(
  nodeType: string = "mock_node",
  text: string = "mock_text",
  startRow: number = 0,
  startColumn: number = 0,
  endRow?: number,
  endColumn?: number,
  additionalProps: Partial<SyntaxNode> = {}
): SyntaxNode {
  const finalEndRow = endRow ?? startRow;
  const finalEndColumn = endColumn ?? startColumn + text.length;

  return {
    text,
    type: nodeType,
    startPosition: { row: startRow, column: startColumn },
    endPosition: { row: finalEndRow, column: finalEndColumn },
    children: [],
    parent: null,
    ...additionalProps,
  } as unknown as SyntaxNode;
}

/**
 * Create a simple mock node with default positions
 */
export function create_simple_mock_node(
  nodeType: string = "mock_node",
  text: string = "mock_text",
  additionalProps: Partial<SyntaxNode> = {}
): SyntaxNode {
  return create_mock_node(
    nodeType,
    text,
    0,
    0,
    undefined,
    undefined,
    additionalProps
  );
}
