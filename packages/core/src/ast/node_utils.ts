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
export function node_to_location(node: SyntaxNode, file_path: FilePath): Location {
  // N.B. Tree-sitter positions are 0-indexed, so we add 1 to convert to 1-indexed
  return {
    file_path: file_path,
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column + 1,
  };
}

export function location_to_start_end_points(location: Location): {
  start: Point;
  end: Point;
} {
  return {
    start: {
      row: location.line - 1,
      column: location.column - 1,
    },
    end: {
      row: location.end_line - 1,
      column: location.end_column - 1,
    },
  };
}