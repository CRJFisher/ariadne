/**
 * Semantic index tests - Python
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { Language, FilePath } from "@ariadnejs/types";
import { query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity } from "./capture_types";
import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_exports } from "./exports";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  describe("Python fixtures", () => {
    it.todo("should parse Python classes and methods");
    it.todo("should parse Python decorators");
    it.todo("should parse Python imports (from/import)");
    it.todo("should parse Python type hints");
  });

  describe("Implicit exports", () => {
    it.skip("should generate implicit exports for all top-level definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "python", "implicit_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures("python", tree, "test.py" as FilePath);

      // Build semantic index to get exports
      const { root_scope, scopes } = build_scope_tree(
        parsed_captures.scopes,
        tree,
        "test.py" as any,
        "python"
      );

      const { symbols } = process_definitions(
        parsed_captures.definitions,
        root_scope,
        scopes,
        "test.py" as any
      );

      const exports = process_exports(
        parsed_captures.exports,
        root_scope,
        symbols,
        "test.py" as any,
        "python"
      );

      // Check that all top-level symbols have exports
      const export_names = exports.map((e) => e.symbol_name).sort();

      // Should include both explicit and implicit exports
      expect(export_names).toContain("public_function");
      expect(export_names).toContain("_private_function");
      expect(export_names).toContain("PublicClass");
      expect(export_names).toContain("_PrivateClass");
      expect(export_names).toContain("PUBLIC_CONSTANT");
      expect(export_names).toContain("_private_variable");
      expect(export_names).toContain("__version__");
      expect(export_names).toContain("__all__");

      // Check modifiers on exports
      const private_export = exports.find(
        (e) => e.symbol_name === "_private_function"
      );
      expect(private_export?.kind).toBe("named");
      expect((private_export as any)?.modifiers).toContain("implicit");
      expect((private_export as any)?.modifiers).toContain("private");

      const magic_export = exports.find((e) => e.symbol_name === "__version__");
      expect((magic_export as any)?.modifiers).toContain("magic");
    });
  });
});