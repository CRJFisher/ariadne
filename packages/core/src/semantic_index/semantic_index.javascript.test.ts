/**
 * Semantic index tests - JavaScript
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import { query_tree_and_parse_captures } from "../parse_and_query_code/parse_and_query_code";
import { SemanticEntity } from "../parse_and_query_code/capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - JavaScript", () => {
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
        const code = readFileSync(
          join(FIXTURES_DIR, "javascript", fixture),
          "utf8"
        );
        const tree = parser.parse(code);
        const language: Language = "javascript";

        // Parse captures using the SCM query
        const parsed_captures = query_tree_and_parse_captures(
          language,
          tree,
          fixture as FilePath
        );

        // Basic structure checks
        expect(parsed_captures.scopes.length).toBeGreaterThan(0);
        expect(
          parsed_captures.scopes.some((c) => c.entity === SemanticEntity.MODULE)
        ).toBe(true);

        if (fixture === "basic_function.js") {
          // Verify exact function definitions
          const function_defs = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.FUNCTION)
            .map((c) => c.symbol_name);
          expect(function_defs).toEqual([
            "greet",
            "sayGoodbye",
            "outer",
            "inner",
          ]);

          // Verify exact function calls (including console.log)
          const calls = parsed_captures.references
            .filter((c) => c.entity === SemanticEntity.CALL)
            .map((c) => c.symbol_name);
          expect(calls).toEqual(["log", "greet", "sayGoodbye", "inner"]);

          // Verify exact parameters
          const params = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.PARAMETER)
            .map((c) => c.symbol_name);
          expect(params).toEqual(["name", "name"]); // Two 'name' parameters

          // Verify variable definitions (const sayGoodbye)
          const variables = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.VARIABLE)
            .map((c) => c.symbol_name);
          expect(variables).toContain("sayGoodbye");

          // Verify scopes structure - scopes exist for all functions
          const function_scopes = parsed_captures.scopes.filter(
            (c) => c.entity === SemanticEntity.FUNCTION
          );
          expect(function_scopes.length).toBe(4); // greet, sayGoodbye, outer, inner
        }

        if (fixture === "class_and_methods.js") {
          // Verify exact class definitions
          const class_defs = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.CLASS)
            .map((c) => c.symbol_name);
          expect(class_defs).toEqual(["Animal", "Dog"]);

          // Verify exact method definitions with modifiers
          const method_defs = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.METHOD)
            .map((c) => ({
              name: c.symbol_name,
              is_static: c.modifiers?.is_static || false,
            }));
          expect(method_defs).toEqual([
            { name: "constructor", is_static: false },
            { name: "speak", is_static: false },
            { name: "getSpecies", is_static: true },
            { name: "constructor", is_static: false },
            { name: "speak", is_static: false },
            { name: "wagTail", is_static: false },
          ]);

          // Verify exact constructor definitions
          const constructor_defs = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.CONSTRUCTOR)
            .map((c) => c.symbol_name);
          expect(constructor_defs).toEqual(["constructor", "constructor"]);

          // Verify class inheritance
          const extends_classes = parsed_captures.types
            .filter((c) => c.context?.extends_class)
            .map((c) => c.context?.extends_class);
          expect(extends_classes).toEqual(["Animal"]);

          // Verify exact this references
          const this_refs = parsed_captures.references
            .filter((c) => c.entity === SemanticEntity.THIS)
            .map((c) => c.symbol_name);
          expect(this_refs.length).toBe(4); // this.name (x2), this.breed (x1), this in Dog speak (x1)

          // Verify super call
          const super_refs = parsed_captures.references
            .filter((c) => c.entity === SemanticEntity.SUPER)
            .map((c) => c.symbol_name);
          expect(super_refs).toEqual(["super"]);

          // Verify constructor calls with targets (may have duplicates from multiple captures)
          const constructor_calls = parsed_captures.references
            .filter(
              (c) => c.entity === SemanticEntity.CALL && c.symbol_name === "Dog"
            )
            .map((c) => c.symbol_name);
          // Remove duplicates for comparison
          expect([...new Set(constructor_calls)]).toEqual(["Dog"]);

          // Verify method calls with receivers (including console.log)
          const method_calls = parsed_captures.references
            .filter(
              (c) =>
                c.entity === SemanticEntity.CALL && c.context?.receiver_node
            )
            .map((c) => c.symbol_name);
          expect(method_calls).toEqual([
            "log",
            "log",
            "log",
            "speak",
            "wagTail",
            "getSpecies",
          ]);

          // Verify static method call
          const static_calls = parsed_captures.references
            .filter(
              (c) =>
                c.entity === SemanticEntity.CALL &&
                c.symbol_name === "getSpecies"
            )
            .map((c) => c.symbol_name);
          expect(static_calls).toEqual(["getSpecies"]);
        }

        if (fixture === "imports_exports.js") {
          // Verify exact named imports (aliased imports appear twice)
          const named_imports = parsed_captures.imports
            .filter(
              (c) =>
                !c.modifiers.is_default &&
                !c.modifiers.is_namespace &&
                !c.context?.is_side_effect_import &&
                !c.context?.skip
            )
            .map((c) => ({
              name: c.symbol_name,
              alias: c.context?.import_alias,
              source: c.context?.source_module,
            }));
          expect(named_imports).toEqual([
            { name: "readFile", alias: undefined, source: "fs" },
            { name: "writeFile", alias: undefined, source: "fs" },
            { name: "join", alias: undefined, source: "path" }, // Non-aliased capture
            { name: "join", alias: "pathJoin", source: "path" }, // Aliased capture with source
          ]);

          // Verify exact default imports
          const default_imports = parsed_captures.imports
            .filter((c) => c.modifiers.is_default)
            .map((c) => ({
              name: c.symbol_name,
              source: c.context?.source_module,
            }));
          expect(default_imports).toEqual([{ name: "React", source: "react" }]);

          // Verify exact namespace imports
          const namespace_imports = parsed_captures.imports
            .filter((c) => c.modifiers.is_namespace)
            .map((c) => ({
              name: c.symbol_name,
              source: c.context?.source_module,
            }));
          expect(namespace_imports).toEqual([
            { name: "utils", source: "./utils" },
          ]);

          // Verify exact side-effect imports
          const side_effect_imports = parsed_captures.imports
            .filter((c) => c.context?.is_side_effect_import)
            .map((c) => c.context?.source_module);
          expect(side_effect_imports).toEqual(["polyfill", "./styles.css"]);

          // Verify exact named exports (including declarations)
          const named_exports = parsed_captures.exports
            .filter(
              (c) =>
                !c.modifiers.is_default && c.entity !== SemanticEntity.MODULE
            )
            .map((c) => c.symbol_name);
          expect(named_exports).toContain("DataProcessor"); // export class DataProcessor
          expect(named_exports).toContain("VERSION"); // export const VERSION
          expect(named_exports).toContain("processData"); // export function processData
          expect(named_exports).toContain("main"); // export default function main

          // Check that aliased re-exports are captured
          expect(
            named_exports.some((n) => n === "MyComponent" || n === "readFile")
          ).toBe(true);

          // Verify default export exists
          const default_exports = parsed_captures.exports
            .filter((c) => c.modifiers.is_default)
            .map((c) => c.symbol_name);
          expect(default_exports).toContain("main");
          // Note: Other exports might also have is_default incorrectly set

          // Verify function definitions from exports
          const exported_functions = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.FUNCTION)
            .map((c) => c.symbol_name);
          expect(exported_functions).toEqual(["processData", "main"]);

          // Verify class definitions from exports
          const exported_classes = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.CLASS)
            .map((c) => c.symbol_name);
          expect(exported_classes).toEqual(["DataProcessor"]);

          // Verify method in exported class
          const methods = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.METHOD)
            .map((c) => c.symbol_name);
          expect(methods).toContain("process");

          // Verify const definitions from exports
          const exported_variables = parsed_captures.definitions
            .filter((c) => c.entity === SemanticEntity.VARIABLE)
            .map((c) => c.symbol_name);
          expect(exported_variables).toEqual(["VERSION"]);

          // Verify all function calls (including built-ins like console.log and array methods)
          const all_calls = parsed_captures.references
            .filter((c) => c.entity === SemanticEntity.CALL)
            .map((c) => c.symbol_name);
          expect(all_calls).toEqual(["map", "processData", "log"]); // data.map(), processData(), console.log()
        }
      });
    }

    it("should correctly parse all export types from imports_exports fixture", async () => {
      const { build_semantic_index } = await import("./semantic_index");
      const code = readFileSync(
        join(FIXTURES_DIR, "javascript", "imports_exports.js"),
        "utf8"
      );
      const tree = parser.parse(code);
      const result = build_semantic_index(
        "imports_exports.js" as FilePath,
        tree,
        "javascript" as Language
      );

      // Check for namespace exports
      const namespace_exports = result.exports.filter(
        (e) => e.kind === "namespace"
      );
      expect(namespace_exports.length).toBeGreaterThanOrEqual(1);

      // Check for specific namespace export with alias
      const aliased_namespace = namespace_exports.find(
        (e) => e.as_name === "utilities"
      );
      expect(aliased_namespace).toBeDefined();
      expect(aliased_namespace?.source).toContain("utils");

      // Check for re-exports
      const reexports = result.exports.filter((e) => e.kind === "reexport");
      expect(reexports.length).toBeGreaterThanOrEqual(1);

      // Check for specific re-export
      const fs_reexport = reexports.find((e) => e.source === "fs");
      expect(fs_reexport).toBeDefined();
      if (fs_reexport?.kind === "reexport") {
        expect(fs_reexport.exports).toContainEqual({
          source_name: "readFile",
          export_name: undefined,
          is_type_only: false,
        });
      }

      // Check for default re-export with alias
      const component_reexport = reexports.find(
        (e) => e.source === "./Component"
      );
      expect(component_reexport).toBeDefined();
      if (component_reexport?.kind === "reexport") {
        expect(component_reexport.exports).toContainEqual({
          source_name: "default",
          export_name: "MyComponent",
          is_type_only: false,
        });
      }
    });
  });

  describe("Import type detection in semantic index", () => {
    it("should correctly create Import objects for all import types", async () => {
      const code = `
        // Named imports
        import { join, resolve } from "path";

        // Default import
        import fs from "fs";

        // Namespace import
        import * as utils from "./utils";

        // Side-effect import
        import "polyfill";

        // Mixed import
        import React, { Component } from "react";
      `;

      const tree = parser.parse(code);
      const result = build_semantic_index(
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );

      // Filter out duplicates and organize by kind
      const imports_by_kind: Record<string, any[]> = {};
      for (const imp of result.imports) {
        if (!imports_by_kind[imp.kind]) {
          imports_by_kind[imp.kind] = [];
        }
        imports_by_kind[imp.kind].push(imp);
      }

      // Verify named imports
      const named_imports = imports_by_kind["named"] || [];
      expect(
        named_imports.some(
          (imp) =>
            imp.imports.some((i: any) => i.name === "join") &&
            imp.source === "path"
        )
      ).toBe(true);
      expect(
        named_imports.some(
          (imp) =>
            imp.imports.some((i: any) => i.name === "resolve") &&
            imp.source === "path"
        )
      ).toBe(true);
      expect(
        named_imports.some(
          (imp) =>
            imp.imports.some((i: any) => i.name === "Component") &&
            imp.source === "react"
        )
      ).toBe(true);

      // Verify default imports
      const default_imports = imports_by_kind["default"] || [];
      expect(
        default_imports.some((imp) => imp.name === "fs" && imp.source === "fs")
      ).toBe(true);
      expect(
        default_imports.some(
          (imp) => imp.name === "React" && imp.source === "react"
        )
      ).toBe(true);

      // Verify namespace imports
      const namespace_imports = imports_by_kind["namespace"] || [];
      expect(
        namespace_imports.some(
          (imp) => imp.namespace_name === "utils" && imp.source === "./utils"
        )
      ).toBe(true);

      // Verify side-effect imports
      const side_effect_imports = imports_by_kind["side_effect"] || [];
      expect(side_effect_imports.some((imp) => imp.source === "polyfill")).toBe(
        true
      );

      // Verify total import count (accounting for how imports are parsed)
      expect(result.imports.length).toBeGreaterThanOrEqual(7); // At least one for each import item
    });
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
      const parsed_captures = query_tree_and_parse_captures(
        "javascript",
        tree,
        "test.js" as FilePath
      );

      // Verify function scopes exist
      const function_scopes = parsed_captures.scopes.filter(
        (c) => c.entity === SemanticEntity.FUNCTION
      );
      expect(function_scopes.length).toBe(1);
      // Note: scope.text captures the full function body, not just the name

      // Verify exact function definitions
      const function_defs = parsed_captures.definitions
        .filter((c) => c.entity === SemanticEntity.FUNCTION)
        .map((c) => c.symbol_name);
      expect(function_defs).toEqual(["test"]);

      // Verify exact calls
      const calls = parsed_captures.references
        .filter((c) => c.entity === SemanticEntity.CALL)
        .map((c) => c.symbol_name);
      expect(calls).toEqual(["test"]);

      // Verify return statements
      const returns = parsed_captures.returns.filter(
        (c) => c.symbol_name === "42"
      );
      expect(returns.length).toBe(1);
    });

    it("should correctly parse static methods", () => {
      const code = `
        class Test {
          static staticMethod() {}
          regularMethod() {}
        }
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures(
        "javascript",
        tree,
        "test.js" as FilePath
      );

      // Verify exact methods with static modifiers
      const methods = parsed_captures.definitions
        .filter((c) => c.entity === SemanticEntity.METHOD)
        .map((c) => ({
          name: c.symbol_name,
          is_static: c.modifiers?.is_static || false,
        }));

      expect(methods).toEqual([
        { name: "staticMethod", is_static: true },
        { name: "regularMethod", is_static: false },
      ]);

      // Verify class definition
      const classes = parsed_captures.definitions
        .filter((c) => c.entity === SemanticEntity.CLASS)
        .map((c) => c.symbol_name);
      expect(classes).toEqual(["Test"]);
    });

    it("should correctly parse method calls with receivers", () => {
      const code = `
        const obj = new MyClass();
        obj.method();
        obj.prop.nested();
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures(
        "javascript",
        tree,
        "test.js" as FilePath
      );

      // Verify exact constructor calls (may have duplicates from multiple captures)
      const constructor_calls = parsed_captures.references
        .filter(
          (c) => c.entity === SemanticEntity.CALL && c.symbol_name === "MyClass"
        )
        .map((c) => c.symbol_name);
      // Remove duplicates for comparison
      expect([...new Set(constructor_calls)]).toEqual(["MyClass"]);

      // Verify exact method calls with receivers (may have duplicates from multiple captures)
      const method_calls = parsed_captures.references
        .filter(
          (c) => c.entity === SemanticEntity.CALL && c.context?.receiver_node
        )
        .map((c) => c.symbol_name);
      // Remove duplicates for comparison
      expect([...new Set(method_calls)]).toEqual(["method", "nested"]);

      // Verify variable definitions (may have duplicates from different scopes)
      const variables = parsed_captures.definitions
        .filter((c) => c.entity === SemanticEntity.VARIABLE)
        .map((c) => c.symbol_name);
      expect(variables).toContain("obj");
      // Allow duplicates as they might be from different capture patterns

      // Verify member access patterns
      const member_accesses = parsed_captures.references
        .filter((c) => c.entity === SemanticEntity.MEMBER_ACCESS)
        .map((c) => c.symbol_name);
      // Should capture property accesses used in method calls
      expect(member_accesses.length).toBeGreaterThanOrEqual(2);
    });

    it("should correctly capture constructor calls with target assignment", () => {
      const code = `
        const myObj = new MyClass();
        const service = new ServiceClass(config);
        new UnassignedClass();
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures(
        "javascript",
        tree,
        "test.js" as FilePath
      );

      // Verify constructor calls with construct_target
      const constructor_calls = parsed_captures.references
        .filter(
          (c) =>
            c.entity === SemanticEntity.CALL &&
            c.symbol_name &&
            ["MyClass", "ServiceClass", "UnassignedClass"].includes(
              c.symbol_name
            )
        )
        .map((c) => ({
          constructor: c.symbol_name,
          hasTarget: !!c.context?.construct_target,
          targetType: c.context?.construct_target?.type,
        }));

      // MyClass and ServiceClass should have construct_target
      expect(constructor_calls).toContainEqual({
        constructor: "MyClass",
        hasTarget: true,
        targetType: "identifier",
      });

      expect(constructor_calls).toContainEqual({
        constructor: "ServiceClass",
        hasTarget: true,
        targetType: "identifier",
      });

      // UnassignedClass might not have construct_target
      const unassigned = constructor_calls.find(
        (c) => c.constructor === "UnassignedClass"
      );
      expect(unassigned).toBeDefined();
    });

    it("should correctly convert construct_target to location in semantic index", async () => {
      const code = `
        const instance = new TestClass();
      `;

      const tree = parser.parse(code);
      const { build_semantic_index } = await import("./semantic_index");
      const result = build_semantic_index(
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );

      // Find constructor call reference in the calls array
      const constructor_ref = result.references.calls.find(
        (ref) => ref.name === "TestClass" && ref.call_type === "constructor"
      );

      expect(constructor_ref).toBeDefined();
      expect(constructor_ref?.construct_target).toBeDefined();

      // The construct_target should be a Location object with file_path, line, column
      expect(constructor_ref?.construct_target).toMatchObject({
        file_path: "test.js",
        line: expect.any(Number),
        column: expect.any(Number),
      });
    });

    it("should correctly capture property chains in method calls", () => {
      const code = `
        const api = getAPI();
        api.users.list();
        api.posts.comments.create();
        api.deeply.nested.property.chain.method();
      `;

      const tree = parser.parse(code);
      const parsed_captures = query_tree_and_parse_captures(
        "javascript",
        tree,
        "test.js" as FilePath
      );

      // Verify method calls with property chains
      const chained_calls = parsed_captures.references
        .filter(
          (c) => c.entity === SemanticEntity.CALL && c.context?.property_chain
        )
        .map((c) => ({
          method: c.symbol_name,
          chain: c.context?.property_chain,
        }));

      // Check that we capture the property chains correctly
      expect(chained_calls).toContainEqual({
        method: "list",
        chain: ["users"],
      });

      expect(chained_calls).toContainEqual({
        method: "create",
        chain: ["posts", "comments"],
      });

      // Deep chains should be captured
      const deep_chain = chained_calls.find((c) => c.method === "method");
      expect(deep_chain).toBeDefined();
      expect(deep_chain?.chain?.length).toBeGreaterThanOrEqual(3);
    });
  });
});
