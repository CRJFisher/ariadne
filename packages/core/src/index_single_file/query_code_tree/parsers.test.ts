import { describe, it, expect } from "vitest";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { LANGUAGE_TO_TREESITTER_LANG, SUPPORTED_LANGUAGES } from "./parsers";

describe("parsers", () => {
  describe("LANGUAGE_TO_TREESITTER_LANG", () => {
    it("maps each supported language to its tree-sitter grammar", () => {
      expect([...LANGUAGE_TO_TREESITTER_LANG.keys()]).toEqual([
        "javascript",
        "typescript",
        "python",
        "rust",
      ]);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("javascript")).toBe(JavaScript);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("typescript")).toBe(
        TypeScript.tsx
      );
      expect(LANGUAGE_TO_TREESITTER_LANG.get("python")).toBe(Python);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("rust")).toBe(Rust);
    });
  });

  describe("SUPPORTED_LANGUAGES", () => {
    it("lists exactly the languages with a tree-sitter grammar", () => {
      expect(SUPPORTED_LANGUAGES).toEqual([
        "javascript",
        "typescript",
        "python",
        "rust",
      ]);
      expect([...LANGUAGE_TO_TREESITTER_LANG.keys()]).toEqual([
        ...SUPPORTED_LANGUAGES,
      ]);
    });
  });
});
