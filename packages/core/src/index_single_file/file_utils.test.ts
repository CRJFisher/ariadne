/**
 * Tests for file utility types and interfaces
 */

import { describe, it, expect } from "vitest";
import type { ParsedFile } from "./file_utils";
import type { FilePath, Language } from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";

describe("file_utils", () => {
  describe("ParsedFile interface", () => {
    it("should accept a valid ParsedFile object", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("const x = 1;");

      const parsedFile: ParsedFile = {
        file_path: "test.js" as FilePath,
        file_lines: 1,
        file_end_column: 12,
        tree: tree,
        lang: "javascript" as Language,
      };

      // Verify all required properties exist
      expect(parsedFile.file_path).toBe("test.js");
      expect(parsedFile.file_lines).toBe(1);
      expect(parsedFile.file_end_column).toBe(12);
      expect(parsedFile.tree).toBe(tree);
      expect(parsedFile.lang).toBe("javascript");
    });

    it("should work with different languages", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("function test() {}");

      const languages: Language[] = ["javascript", "typescript", "python", "rust"];

      languages.forEach(language => {
        const parsedFile: ParsedFile = {
          file_path: `test.${language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "python" ? "py" : "rs"}` as FilePath,
          file_lines: 1,
          file_end_column: 18,
          tree: tree,
          lang: language,
        };

        expect(parsedFile.lang).toBe(language);
      });
    });

    it("should handle files with multiple lines", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const multiLineCode = `function test() {
  return 42;
}`;
      const tree = parser.parse(multiLineCode);

      const parsedFile: ParsedFile = {
        file_path: "multiline.js" as FilePath,
        file_lines: 3,
        file_end_column: 1, // Last line has just "}"
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsedFile.file_lines).toBe(3);
      expect(parsedFile.file_end_column).toBe(1);
    });

    it("should handle empty files", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("");

      const parsedFile: ParsedFile = {
        file_path: "empty.js" as FilePath,
        file_lines: 0,
        file_end_column: 0,
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsedFile.file_lines).toBe(0);
      expect(parsedFile.file_end_column).toBe(0);
    });

    it("should handle files with long lines", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const longLine = "const veryLongVariableName = ".repeat(10) + "42;";
      const tree = parser.parse(longLine);

      const parsedFile: ParsedFile = {
        file_path: "long.js" as FilePath,
        file_lines: 1,
        file_end_column: longLine.length,
        tree: tree,
        lang: "javascript" as Language,
      };

      expect(parsedFile.file_end_column).toBe(longLine.length);
    });
  });
});