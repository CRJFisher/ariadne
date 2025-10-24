/**
 * Tests for AST node utility functions
 */

import { describe, it, expect } from "vitest";
import { node_to_location } from "./node_utils";
import type { FilePath } from "@ariadnejs/types";
import type { SyntaxNode, Point } from "tree-sitter";

// Mock SyntaxNode for testing
function createMockNode(
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
): SyntaxNode {
  return {
    startPosition: { row: startRow, column: startColumn },
    endPosition: { row: endRow, column: endColumn },
  } as SyntaxNode;
}

describe("node_utils", () => {
  const test_file: FilePath = "test.ts" as FilePath;

  describe("node_to_location", () => {
    it("should convert tree-sitter node positions to 1-indexed locations", () => {
      // Tree-sitter uses 0-indexed positions
      const node = createMockNode(0, 0, 2, 10);

      const location = node_to_location(node, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 1, // 0 + 1
        start_column: 1, // 0 + 1
        end_line: 3, // 2 + 1
        end_column: 10, // 2 (no +1 for end column, as per docs)
      });
    });

    it("should handle multi-line nodes correctly", () => {
      // Node spanning from line 5, column 10 to line 7, column 5
      const node = createMockNode(4, 9, 6, 4);

      const location = node_to_location(node, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 5,
        start_column: 10,
        end_line: 7,
        end_column: 4,
      });
    });

    it("should handle single character nodes", () => {
      // Single character at position (0, 5)
      const node = createMockNode(0, 5, 0, 6);

      const location = node_to_location(node, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 1,
        start_column: 6,
        end_line: 1,
        end_column: 6,
      });
    });

    it("should preserve file path from parameter", () => {
      const different_file: FilePath = "src/components/Button.tsx" as FilePath;
      const node = createMockNode(10, 15, 12, 20);

      const location = node_to_location(node, different_file);

      expect(location.file_path).toBe("src/components/Button.tsx");
    });
  });

  describe("edge cases", () => {
    it("should handle very large line numbers", () => {
      const node = createMockNode(999999, 0, 1000000, 50);

      const location = node_to_location(node, test_file);

      expect(location.start_line).toBe(1000000);
      expect(location.end_line).toBe(1000001);
    });
  });
});