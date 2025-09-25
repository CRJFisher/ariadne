/**
 * Tests for bug fixes in semantic_index query handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Language, FilePath } from "@ariadnejs/types";
import Parser, { Tree } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";

// Mock the query_loader module
vi.mock("./query_loader", () => ({
  load_query: vi.fn(),
  LANGUAGE_TO_TREESITTER_LANG: new Map([
    ["javascript", JavaScript],
    // Intentionally missing other languages to test error handling
  ]),
}));

describe("Semantic Index Query Bug Fixes", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("query_tree_and_parse_captures", () => {
    it("should throw descriptive error when parser is not found for language", async () => {
      // Import after mocking
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Mock successful query loading
      vi.mocked(load_query).mockReturnValue("(identifier) @test");

      // Parse a simple JavaScript program
      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.ts" as FilePath;

      // Try to use TypeScript (which we intentionally didn't include in the mocked map)
      expect(() => {
        query_tree_and_parse_captures("typescript", tree, file_path);
      }).toThrow("No tree-sitter parser found for language: typescript");
    });

    it("should work correctly when parser is found", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Mock successful query loading with a valid query
      vi.mocked(load_query).mockReturnValue("(identifier) @def.variable");

      // Parse a simple JavaScript program
      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.js" as FilePath;

      // This should work without throwing
      expect(() => {
        query_tree_and_parse_captures("javascript", tree, file_path);
      }).not.toThrow();
    });

    it("should handle undefined parser gracefully", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query, LANGUAGE_TO_TREESITTER_LANG } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Mock successful query loading
      vi.mocked(load_query).mockReturnValue("(identifier) @test");

      // Temporarily remove the parser from the map
      const originalParser = LANGUAGE_TO_TREESITTER_LANG.get("javascript");
      LANGUAGE_TO_TREESITTER_LANG.delete("javascript");

      try {
        const code = "const x = 5;";
        const tree = parser.parse(code);
        const file_path = "test.js" as FilePath;

        expect(() => {
          query_tree_and_parse_captures("javascript", tree, file_path);
        }).toThrow("No tree-sitter parser found for language: javascript");
      } finally {
        // Restore the original parser
        if (originalParser) {
          LANGUAGE_TO_TREESITTER_LANG.set("javascript", originalParser);
        }
      }
    });

    it("should preserve error from load_query if query loading fails", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Mock query loading failure
      vi.mocked(load_query).mockImplementation(() => {
        throw new Error("Failed to load query: File not found");
      });

      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.js" as FilePath;

      expect(() => {
        query_tree_and_parse_captures("javascript", tree, file_path);
      }).toThrow("Failed to load query: File not found");
    });

    it("should handle invalid query syntax errors from Query constructor", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Mock loading of invalid query syntax
      vi.mocked(load_query).mockReturnValue("(invalid query syntax [[[");

      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.js" as FilePath;

      expect(() => {
        query_tree_and_parse_captures("javascript", tree, file_path);
      }).toThrow(); // Should throw due to invalid query syntax
    });
  });

  describe("Runtime Error Prevention", () => {
    it("should prevent the original undefined parser bug", async () => {
      // This test specifically verifies the fix for the original bug:
      // new Query(LANGUAGE_TO_TREESITTER_LANG.get(lang), query_string)
      // where get(lang) could return undefined

      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      vi.mocked(load_query).mockReturnValue("(identifier) @test");

      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.unknown" as FilePath;

      // Before the fix, this would have caused:
      // TypeError: Cannot read properties of undefined (reading constructor or similar)
      // Now it should throw a descriptive error
      expect(() => {
        query_tree_and_parse_captures("unknown" as Language, tree, file_path);
      }).toThrow("No tree-sitter parser found for language: unknown");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null tree gracefully", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      vi.mocked(load_query).mockReturnValue("(identifier) @test");

      const file_path = "test.js" as FilePath;

      expect(() => {
        query_tree_and_parse_captures(
          "javascript",
          null as unknown as Tree,
          file_path
        );
      }).toThrow(); // Should throw due to null tree
    });

    it("should handle empty query string", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      vi.mocked(load_query).mockReturnValue("");

      const code = "const x = 5;";
      const tree = parser.parse(code);
      const file_path = "test.js" as FilePath;

      // Empty query should work (no captures)
      expect(() => {
        query_tree_and_parse_captures("javascript", tree, file_path);
      }).not.toThrow();
    });

    it("should handle very large query results", async () => {
      const { query_tree_and_parse_captures } = await import(
        "../parse_and_query_code"
      );
      const { load_query } = await import(
        "../parse_and_query_code/query_loader"
      );

      // Query that captures many nodes
      vi.mocked(load_query).mockReturnValue(
        "(identifier) @def.variable\n(number) @ref.literal"
      );

      // Large code that will generate many captures
      const code = Array(100).fill("const x = 5;").join("\n");
      const tree = parser.parse(code);
      const file_path = "large.js" as FilePath;

      expect(() => {
        query_tree_and_parse_captures("javascript", tree, file_path);
      }).not.toThrow();
    });
  });
});
