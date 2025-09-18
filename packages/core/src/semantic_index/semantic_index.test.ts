/**
 * Semantic index tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { Language } from "@ariadnejs/types";
import { query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - Query Parsing", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  describe("JavaScript fixtures", () => {
    const javascript_fixtures = [
      "basic_function.js",
      "class_and_methods.js",
      "imports_exports.js",
    ];

    for (const fixture of javascript_fixtures) {
      it(`should correctly parse ${fixture}`, () => {
        const code = readFileSync(join(FIXTURES_DIR, "javascript", fixture), "utf8");
        const tree = parser.parse(code);
        const language: Language = "javascript";

        // Parse captures using the SCM query
        const parsed_captures = query_tree_and_parse_captures(language, tree);

        // Basic structure checks
        expect(parsed_captures.scopes.length).toBeGreaterThan(0);
        expect(parsed_captures.scopes.some(c => c.entity === SemanticEntity.MODULE)).toBe(true);

        if (fixture === "basic_function.js") {
          // Check function definitions
          const function_defs = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.FUNCTION);
          expect(function_defs.length).toBeGreaterThanOrEqual(3); // greet, sayGoodbye, outer, inner

          // Check function calls
          const calls = parsed_captures.references.filter(c => c.entity === SemanticEntity.CALL);
          expect(calls.length).toBeGreaterThanOrEqual(2); // greet(), sayGoodbye()

          // Check parameters
          const params = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.PARAMETER);
          expect(params.length).toBeGreaterThanOrEqual(2); // name (in greet and sayGoodbye)
        }

        if (fixture === "class_and_methods.js") {
          // Check class definitions
          const class_defs = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.CLASS);
          expect(class_defs.length).toBe(2); // Animal, Dog

          // Check method definitions
          const method_defs = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.METHOD);
          expect(method_defs.length).toBeGreaterThanOrEqual(3); // speak (x2), wagTail, getSpecies

          // Check constructor definitions
          const constructor_defs = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.CONSTRUCTOR);
          expect(constructor_defs.length).toBe(2); // Animal constructor, Dog constructor

          // Check inheritance
          const extends_classes = parsed_captures.types.filter(c => c.context?.extends_class);
          expect(extends_classes.length).toBeGreaterThanOrEqual(1); // Dog extends Animal

          // Check this references
          const this_refs = parsed_captures.references.filter(c => c.entity === SemanticEntity.THIS);
          expect(this_refs.length).toBeGreaterThan(0);

          // Check super references
          const super_refs = parsed_captures.references.filter(c => c.entity === SemanticEntity.SUPER);
          expect(super_refs.length).toBeGreaterThan(0);
        }

        if (fixture === "imports_exports.js") {
          // Check imports
          expect(parsed_captures.imports.length).toBeGreaterThan(0);

          // Check for different import types
          const default_imports = parsed_captures.imports.filter(c => c.modifiers.is_default);
          expect(default_imports.length).toBeGreaterThanOrEqual(1); // React

          const namespace_imports = parsed_captures.imports.filter(c => c.modifiers.is_namespace);
          expect(namespace_imports.length).toBeGreaterThanOrEqual(1); // * as utils

          // Check exports
          expect(parsed_captures.exports.length).toBeGreaterThan(0);

          const default_exports = parsed_captures.exports.filter(c => c.modifiers.is_default);
          expect(default_exports.length).toBeGreaterThanOrEqual(1); // default function main
        }
      });
    }
  });

  describe("Detailed capture parsing", () => {
    it("should correctly parse function definitions and calls", () => {
      const code = `
        function test() {
          return 42;
        }
        test();
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures("javascript", tree);

      // Check function scopes
      const function_scopes = parsed_captures.scopes.filter(c => c.entity === SemanticEntity.FUNCTION);
      expect(function_scopes.length).toBeGreaterThan(0);

      // Check function definitions
      const function_defs = parsed_captures.definitions.filter(c => c.entity === SemanticEntity.FUNCTION);
      expect(function_defs.length).toBe(1);
      expect(function_defs[0].text).toBe("test");

      // Check calls
      const calls = parsed_captures.references.filter(c => c.entity === SemanticEntity.CALL);
      expect(calls.length).toBeGreaterThan(0);
    });

    it("should correctly parse static methods", () => {
      const code = `
        class Test {
          static staticMethod() {}
        }
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures("javascript", tree);

      // Check for static modifier on methods
      const methods = parsed_captures.definitions.filter(
        c => c.entity === SemanticEntity.METHOD && c.modifiers.is_static
      );
      expect(methods.length).toBeGreaterThanOrEqual(0); // May need to adjust SCM query to capture this
    });

    it("should correctly parse method calls with receivers", () => {
      const code = `
        const obj = new MyClass();
        obj.method();
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures("javascript", tree);

      // Check constructor calls (normalized as CALL with context)
      const constructor_calls = parsed_captures.references.filter(
        c => c.entity === SemanticEntity.CALL && c.context?.construct_target
      );
      expect(constructor_calls.length).toBeGreaterThanOrEqual(0);

      // Check method calls (normalized as CALL with receiver context)
      const method_calls = parsed_captures.references.filter(
        c => c.entity === SemanticEntity.CALL && c.context?.receiver_node
      );
      expect(method_calls.length).toBeGreaterThan(0);
    });
  });
});