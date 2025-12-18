/**
 * Tests for file utility types and interfaces
 */

import { describe, it, expect } from "vitest";
import type { ParsedFile } from "./index_single_file.file_utils";
import type { FilePath, Language } from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";

describe("file_utils", () => {
  describe("ParsedFile interface", () => {
    it("should accept a valid ParsedFile object", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("const x = 1;");

      const parsed_file: ParsedFile = {
        file_path: "test.js" as FilePath,
        file_lines: 1,
        file_end_column: 12,
        tree: tree,
        lang: "javascript" as Language,
      };

      // Verify all required properties exist
      expect(parsed_file.file_path).toBe("test.js");
      expect(parsed_file.file_lines).toBe(1);
      expect(parsed_file.file_end_column).toBe(12);
      expect(parsed_file.tree).toBe(tree);
      expect(parsed_file.lang).toBe("javascript");
    });

    it("should work with different languages", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("function test() {}");

      const languages: Language[] = ["javascript", "typescript", "python", "rust"];

      languages.forEach(language => {
        const parsed_file: ParsedFile = {
          file_path: `test.${language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "python" ? "py" : "rs"}` as FilePath,
          file_lines: 1,
          file_end_column: 18,
          tree: tree,
          lang: language,
        };

        expect(parsed_file.lang).toBe(language);
      });
    });

    it("should handle files with multiple lines", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const multi_line_code = `function test() {
  return 42;
}`;
      const tree = parser.parse(multi_line_code);

      const parsed_file: ParsedFile = {
        file_path: "multiline.js" as FilePath,
        file_lines: 3,
        file_end_column: 1, // Last line has just "}"
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsed_file.file_lines).toBe(3);
      expect(parsed_file.file_end_column).toBe(1);
    });

    it("should handle empty files", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("");

      const parsed_file: ParsedFile = {
        file_path: "empty.js" as FilePath,
        file_lines: 0,
        file_end_column: 0,
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsed_file.file_lines).toBe(0);
      expect(parsed_file.file_end_column).toBe(0);
    });

    it("should handle files with long lines", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const long_line = "const veryLongVariableName = ".repeat(10) + "42;";
      const tree = parser.parse(long_line);

      const parsed_file: ParsedFile = {
        file_path: "long.js" as FilePath,
        file_lines: 1,
        file_end_column: long_line.length,
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsed_file.file_end_column).toBe(long_line.length);
    });
  });
});