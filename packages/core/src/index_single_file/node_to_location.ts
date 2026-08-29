/**
 * Converts a tree-sitter AST node to a Location
 */

import type { SyntaxNode } from "tree-sitter";
import { FilePath, Location } from "@ariadnejs/types";

export function node_to_location(
  node: SyntaxNode,
  file_path: FilePath,
): Location {
  // Each read of `startPosition` or `endPosition` crosses into the tree-sitter
  // binding and allocates a fresh Point, so the four integers below cost one
  // crossing each rather than two.
  const start = node.startPosition;
  const end = node.endPosition;

  // N.B. Tree-sitter positions are 0-indexed, so we add 1 to convert to 1-indexed
  // Tree-sitter's endPosition is exclusive (0-indexed), which when converted to
  // 1-indexed (without adding 1 to column) becomes inclusive (points to last char)
  // Example: endPosition {row: 2, column: 1} -> 1-indexed {line: 3, column: 1}
  return {
    file_path: file_path,
    start_line: start.row + 1,
    start_column: start.column + 1,
    end_line: end.row + 1,
    end_column: end.column,
  };
}
