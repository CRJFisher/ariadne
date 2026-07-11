import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  load_query,
  query_cache,
  cached_queries_dir_cache,
  get_queries_dir,
  SUPPORTED_LANGUAGES,
} from "./query_loader";

describe("query_loader", () => {
  beforeEach(() => {
    query_cache.clear();
    cached_queries_dir_cache.value = null;
  });

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

  describe("get_queries_dir", () => {
    it("resolves the queries directory beside this module", () => {
      const dir = get_queries_dir();
      expect(dir).toBe(join(__dirname, "queries"));
    });

    it("memoizes the resolved path across calls", () => {
      const first = get_queries_dir();
      expect(cached_queries_dir_cache.value).toBe(first);
      expect(get_queries_dir()).toBe(first);
    });
  });

  describe("load_query", () => {
    it("returns the exact contents of each language's .scm file", () => {
      for (const language of SUPPORTED_LANGUAGES) {
        const expected = readFileSync(
          join(__dirname, "queries", `${language}.scm`),
          "utf-8"
        );
        expect(load_query(language)).toEqual(expected);
      }
    });

    it("returns the cached string on repeat loads rather than re-reading the file", () => {
      const first = load_query("javascript");
      const second = load_query("javascript");
      expect(second).toBe(first);
      expect(query_cache.size).toBe(1);
    });

    it("caches each language independently", () => {
      const js = load_query("javascript");
      const py = load_query("python");
      expect(query_cache.size).toBe(2);
      expect(js).not.toBe(py);
      expect(load_query("javascript")).toBe(js);
      expect(load_query("python")).toBe(py);
      expect(query_cache.size).toBe(2);
    });

    it("throws for an unsupported language, naming the supported set", () => {
      expect(() => load_query("java" as Language)).toThrow(
        "Unsupported language: java. Supported languages: javascript, typescript, python, rust"
      );
    });

    it("throws for null, undefined, or empty language", () => {
      // @ts-expect-error runtime rejection of invalid input
      expect(() => load_query(null)).toThrow(
        "Invalid language: null. Language cannot be null, undefined, or empty."
      );
      // @ts-expect-error runtime rejection of invalid input
      expect(() => load_query(undefined)).toThrow(
        "Invalid language: undefined. Language cannot be null, undefined, or empty."
      );
      expect(() => load_query("" as Language)).toThrow(
        "Invalid language: . Language cannot be null, undefined, or empty."
      );
    });

    it("throws when the grammar is missing for an otherwise supported language", () => {
      const original = LANGUAGE_TO_TREESITTER_LANG.get("javascript");
      LANGUAGE_TO_TREESITTER_LANG.delete("javascript");
      try {
        expect(() => load_query("javascript")).toThrow(
          "No tree-sitter parser available for language: javascript"
        );
      } finally {
        LANGUAGE_TO_TREESITTER_LANG.set("javascript", original!);
      }
    });
  });

  describe("load_query with a substituted queries directory", () => {
    let temp_dir: string;

    beforeEach(() => {
      temp_dir = mkdtempSync(join(tmpdir(), "query-loader-"));
      cached_queries_dir_cache.value = temp_dir;
    });

    afterEach(() => {
      rmSync(temp_dir, { recursive: true, force: true });
    });

    it("throws a file-load error when the .scm file is missing", () => {
      expect(() => load_query("rust")).toThrow(
        /Failed to load semantic index query for language 'rust'/
      );
    });

    it("throws a syntax error when the .scm file is malformed", () => {
      writeFileSync(join(temp_dir, "javascript.scm"), "(((", "utf-8");
      expect(() => load_query("javascript")).toThrow(
        /Invalid query syntax for javascript/
      );
    });

    it("does not cache a query that failed to load", () => {
      expect(() => load_query("rust")).toThrow();
      expect(query_cache.has("rust")).toBe(false);
    });
  });
});
