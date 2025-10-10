/**
 * AST node utility functions
 *
 * Provides helpers for working with tree-sitter AST nodes
 */

import { SyntaxNode, Point } from "tree-sitter";
import { FilePath, Location } from "@ariadnejs/types";

/**
 * Convert a tree-sitter node to a SimpleRange
 */
export function node_to_location(
  node: SyntaxNode,
  file_path: FilePath,
): Location {
  // N.B. Tree-sitter positions are 0-indexed, so we add 1 to convert to 1-indexed
  // Tree-sitter's endPosition is exclusive (0-indexed), which when converted to
  // 1-indexed (without adding 1 to column) becomes inclusive (points to last char)
  // Example: endPosition {row: 2, column: 1} -> 1-indexed {line: 3, column: 1}
  return {
    file_path: file_path,
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column + 1,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

/**
 * Create a location from explicit start and end positions.
 *
 * Use this when you have Parser.Point objects but not a SyntaxNode.
 * Example: When manually finding delimiter positions (Python's colon).
 *
 * Tree-sitter positions are 0-indexed, we convert to 1-indexed.
 */
export function position_to_location(
  start: Point,
  end: Point,
  file_path: FilePath,
): Location {
  return {
    file_path,
    start_line: start.row + 1,
    start_column: start.column + 1,
    end_line: end.row + 1,
    end_column: end.column,
  };
}
