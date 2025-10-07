/**
 * AST node utility functions
 *
 * Provides helpers for working with tree-sitter AST nodes
 */

import { SyntaxNode } from "tree-sitter";
import { FilePath, Location } from "@ariadnejs/types";

/**
 * Convert a tree-sitter node to a SimpleRange
 */
export function node_to_location(
  node: SyntaxNode,
  file_path: FilePath
): Location {
  // N.B. Tree-sitter positions are 0-indexed, so we add 1 to convert to 1-indexed
  // Tree-sitter's endPosition is exclusive (points past the end), and we preserve
  // that convention in 1-indexed positions (exclusive end = last_char_position + 1)
  return {
    file_path: file_path,
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column + 1,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column + 1,
  };
}
