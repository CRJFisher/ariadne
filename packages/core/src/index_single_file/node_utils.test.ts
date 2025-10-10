/**
 * Tests for AST node utility functions
 */

import { describe, it, expect } from "vitest";
import { node_to_location, position_to_location } from "./node_utils";
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

  describe("position_to_location", () => {
    it("should convert Point objects to 1-indexed locations", () => {
      const start: Point = { row: 2, column: 8 };
      const end: Point = { row: 3, column: 15 };

      const location = position_to_location(start, end, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 3, // 2 + 1
        start_column: 9, // 8 + 1
        end_line: 4, // 3 + 1
        end_column: 15, // 15 (no +1 for end column)
      });
    });

    it("should handle same-line positions", () => {
      const start: Point = { row: 0, column: 0 };
      const end: Point = { row: 0, column: 5 };

      const location = position_to_location(start, end, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 1,
        start_column: 1,
        end_line: 1,
        end_column: 5,
      });
    });

    it("should handle zero-width positions", () => {
      const start: Point = { row: 1, column: 10 };
      const end: Point = { row: 1, column: 10 };

      const location = position_to_location(start, end, test_file);

      expect(location).toEqual({
        file_path: "test.ts",
        start_line: 2,
        start_column: 11,
        end_line: 2,
        end_column: 10,
      });
    });

    it("should work with different file paths", () => {
      const python_file: FilePath = "main.py" as FilePath;
      const start: Point = { row: 5, column: 0 };
      const end: Point = { row: 5, column: 20 };

      const location = position_to_location(start, end, python_file);

      expect(location.file_path).toBe("main.py");
      expect(location.start_line).toBe(6);
      expect(location.end_line).toBe(6);
    });
  });

  describe("edge cases", () => {
    it("should handle very large line numbers", () => {
      const node = createMockNode(999999, 0, 1000000, 50);

      const location = node_to_location(node, test_file);

      expect(location.start_line).toBe(1000000);
      expect(location.end_line).toBe(1000001);
    });

    it("should handle very large column numbers", () => {
      const start: Point = { row: 0, column: 999999 };
      const end: Point = { row: 0, column: 1000000 };

      const location = position_to_location(start, end, test_file);

      expect(location.start_column).toBe(1000000);
      expect(location.end_column).toBe(1000000);
    });
  });
});