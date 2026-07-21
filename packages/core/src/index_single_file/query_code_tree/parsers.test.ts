import { describe, it, expect } from "vitest";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  SUPPORTED_LANGUAGES,
  is_tsx_file,
  grammar_for,
} from "./parsers";

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
        TypeScript.typescript
      );
      expect(LANGUAGE_TO_TREESITTER_LANG.get("python")).toBe(Python);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("rust")).toBe(Rust);
    });
  });

  describe("grammar_for", () => {
    it("parses a .tsx file with the tsx grammar and a .ts file with typescript", () => {
      expect(grammar_for("typescript", "/x/Component.tsx")).toBe(TypeScript.tsx);
      expect(grammar_for("typescript", "/x/module.ts")).toBe(
        TypeScript.typescript
      );
    });

    it("uses the default grammar for non-typescript languages regardless of path", () => {
      expect(grammar_for("javascript", "/x/App.jsx")).toBe(JavaScript);
      expect(grammar_for("python", "/x/mod.py")).toBe(Python);
    });
  });

  describe("is_tsx_file", () => {
    it("is true only for a .tsx TypeScript file", () => {
      expect(is_tsx_file("typescript", "/x/Component.tsx")).toBe(true);
      expect(is_tsx_file("typescript", "/x/module.ts")).toBe(false);
      // A `.tsx` path under a non-typescript language is never the tsx dialect.
      expect(is_tsx_file("javascript", "/x/weird.tsx")).toBe(false);
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
