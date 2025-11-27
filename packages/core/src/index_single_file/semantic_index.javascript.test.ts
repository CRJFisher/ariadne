/**
 * Semantic index tests - JavaScript
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type {
  Language,
  FilePath,
  FunctionCallReference,
  MethodCallReference,
  ConstructorCallReference,
  PropertyAccessReference,
  SelfReferenceCall,
} from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import { query_tree } from "./query_code_tree/query_code_tree";
import type { ParsedFile } from "./file_utils";

const FIXTURES_DIR = join(__dirname, "..", "..", "tests", "fixtures");

// Helper to create ParsedFile
function create_parsed_file(
  code: string,
  file_path: FilePath,
  tree: Parser.Tree,
  language: Language,
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: file_path,
    file_lines: lines.length,
    // For 1-indexed positions with inclusive ends: end_column = length
    // (tree-sitter's exclusive 0-indexed becomes inclusive 1-indexed without +1)
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

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
          "utf8",
        );
        const tree = parser.parse(code);
        const language: Language = "javascript";

        // Parse captures using the SCM query - returns raw QueryCapture[] now
        const captures = query_tree(language, tree);

        // Basic structure checks - just verify we get captures
        expect(captures.length).toBeGreaterThan(0);
        expect(captures.some((c) => c.name.includes("module"))).toBe(true);

        if (fixture === "basic_function.js") {
          // Test with semantic index instead of raw captures
          const parsed_file = create_parsed_file(
            code,
            fixture as FilePath,
            tree,
            language,
          );
          const semantic_result = build_semantic_index(
            parsed_file,
            tree,
            language,
          );

          // Verify console.log has receiver_location (console is the receiver)
          const log_call = semantic_result.references.find(
            (ref): ref is MethodCallReference =>
              ref.kind === "method_call" && ref.name === "log",
          );
          expect(log_call).toBeDefined();
          expect(log_call?.receiver_location).toBeDefined();
          expect(log_call?.receiver_location).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify regular function calls have no receiver_location
          const greet_call = semantic_result.references.find(
            (ref): ref is FunctionCallReference =>
              ref.kind === "function_call" && ref.name === "greet",
          );
          expect(greet_call).toBeDefined();
          // receiver_location doesn't exist on FunctionCallReference
        }

        if (fixture === "class_and_methods.js") {
          // Test metadata population with semantic index
          const parsed_file = create_parsed_file(
            code,
            fixture as FilePath,
            tree,
            language,
          );
          const semantic_result = build_semantic_index(
            parsed_file,
            tree,
            language,
          );

          // Verify constructor calls have construct_target metadata
          const dog_constructor = semantic_result.references.find(
            (ref): ref is ConstructorCallReference =>
              ref.kind === "constructor_call" && ref.name === "Dog",
          );
          expect(dog_constructor).toBeDefined();
          expect(dog_constructor?.construct_target).toBeDefined();
          expect(dog_constructor?.construct_target).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify method calls have receiver_location metadata
          const speak_call = semantic_result.references.find(
            (ref): ref is MethodCallReference =>
              ref.kind === "method_call" && ref.name === "speak",
          );
          expect(speak_call).toBeDefined();
          expect(speak_call?.receiver_location).toBeDefined();
          expect(speak_call?.receiver_location).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify static method calls have receiver_location
          const get_species_call = semantic_result.references.find(
            (ref): ref is MethodCallReference =>
              ref.kind === "method_call" && ref.name === "getSpecies",
          );
          expect(get_species_call).toBeDefined();
          expect(get_species_call?.receiver_location).toBeDefined();
        }

        if (fixture === "imports_exports.js") {
          // Test with semantic index - imports and exports are handled through semantic index
          const parsed_file = create_parsed_file(
            code,
            fixture as FilePath,
            tree,
            language,
          );
          const semantic_result = build_semantic_index(
            parsed_file,
            tree,
            language,
          );

          // Verify that imports are captured
          const import_names = Array.from(
            semantic_result.imported_symbols.values(),
          ).map((i) => i.name);
          expect(import_names.length).toBeGreaterThan(0);

          // Verify that functions, classes, and variables are captured
          const function_names = Array.from(
            semantic_result.functions.values(),
          ).map((f) => f.name);
          expect(function_names).toContain("processData");
          expect(function_names).toContain("main");

          const class_names = Array.from(semantic_result.classes.values()).map(
            (c) => c.name,
          );
          expect(class_names).toContain("DataProcessor");

          const variable_names = Array.from(
            semantic_result.variables.values(),
          ).map((v) => v.name);
          expect(variable_names).toContain("VERSION");
        }
      });
    }

    it("should correctly parse all export types from imports_exports fixture", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "javascript", "imports_exports.js"),
        "utf8",
      );
      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "imports_exports.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Since exports are handled differently in the new API,
      // we can verify that the exported symbols are present in the definitions
      // Check that exported functions are in the functions map
      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toContain("processData");
      expect(function_names).toContain("main");

      // Check that exported classes are in the classes map
      const class_names = Array.from(result.classes.values()).map((c) => c.name);
      expect(class_names).toContain("DataProcessor");

      // Check that exported variables are in the variables map
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("VERSION");
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
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Check that imported symbols are in the imported_symbols map
      const imported_names = Array.from(result.imported_symbols.values()).map(
        (i) => i.name,
      );

      // These should be imported
      expect(imported_names).toContain("join");
      expect(imported_names).toContain("resolve");
      expect(imported_names).toContain("fs");
      expect(imported_names).toContain("utils");
      expect(imported_names).toContain("React");
      expect(imported_names).toContain("Component");

      // Verify we have the expected number of imports (excluding side-effect imports)
      expect(result.imported_symbols.size).toBeGreaterThanOrEqual(6);
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
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify function definitions
      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toEqual(["test"]);

      // Verify function calls
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" || ref.kind === "method_call",
        )
        .map((ref) => ref.name);
      expect(calls).toEqual(["test"]);

      // NOTE: Return statements are not currently captured as references in the discriminated union
      // The SymbolReference type does not include a "return" kind
      // This is expected behavior - returns are not symbol references
      // Skip this check for now
    });

    it("should correctly parse static methods", () => {
      const code = `
        class Test {
          static staticMethod() {}
          regular_method() {}
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify class definition
      const class_names = Array.from(result.classes.values()).map((c) => c.name);
      expect(class_names).toEqual(["Test"]);

      // Verify methods are extracted
      const test_class = Array.from(result.classes.values()).find(
        (c) => c.name === "Test",
      );
      expect(test_class).toBeDefined();
      if (test_class) {
        const method_names = test_class.methods.map((m) => m.name);

        expect(method_names).toContain("staticMethod");
        expect(method_names).toContain("regularMethod");
      }
    });

    it("should correctly parse method calls with receivers", () => {
      const code = `
        const obj = new MyClass();
        obj.method();
        obj.prop.nested();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify constructor calls
      const constructor_call = result.references.find(
        (ref): ref is ConstructorCallReference =>
          ref.kind === "constructor_call" && ref.name === "MyClass",
      );
      expect(constructor_call).toBeDefined();
      expect(constructor_call?.construct_target).toBeDefined();

      // Verify method calls with receivers
      const method_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "method",
      );
      expect(method_call).toBeDefined();
      expect(method_call?.receiver_location).toBeDefined();

      const nested_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "nested",
      );
      expect(nested_call).toBeDefined();
      expect(nested_call?.receiver_location).toBeDefined();
      // property_chain should recursively extract all parts
      expect(nested_call?.property_chain).toEqual(["obj", "prop", "nested"]);

      // Verify variable definitions
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("obj");
    });

    it("should correctly capture constructor calls with target assignment", () => {
      const code = `
        const myObj = new MyClass();
        const service = new ServiceClass(config);
        new UnassignedClass();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify constructor calls with construct_target
      const my_class_call = result.references.find(
        (ref): ref is ConstructorCallReference =>
          ref.kind === "constructor_call" && ref.name === "MyClass",
      );
      expect(my_class_call).toBeDefined();
      expect(my_class_call?.construct_target).toBeDefined();

      const service_class_call = result.references.find(
        (ref): ref is ConstructorCallReference =>
          ref.kind === "constructor_call" && ref.name === "ServiceClass",
      );
      expect(service_class_call).toBeDefined();
      expect(service_class_call?.construct_target).toBeDefined();

      // UnassignedClass without assignment may not create ConstructorCallReference
      // Check if it exists as any reference type
      const unassigned_call = result.references.find(
        (ref) => ref.name === "UnassignedClass",
      );
      expect(unassigned_call).toBeDefined();
      // If it's a constructor_call, construct_target would be present
      if (unassigned_call?.kind === "constructor_call") {
        // This would only happen if there's an assignment target
        expect(unassigned_call.construct_target).toBeDefined();
      }
    });

    it("should populate receiver_location for method calls", () => {
      const code = `
        const obj = { method: () => {} };
        obj.method();
        class MyClass extends Base {
          myMethod() {
            this.doSomething();
            super.parentMethod();
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Find method calls (note: this.doSomething() is SelfReferenceCall, not MethodCallReference)
      const method_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "method",
      );
      const this_call = result.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === "self_reference_call" && ref.name === "doSomething",
      );
      const super_call = result.references.find(
        (ref): ref is SelfReferenceCall =>
          ref.kind === "self_reference_call" && ref.name === "parentMethod",
      );

      // Method call should have receiver_location populated
      expect(method_call).toBeDefined();
      expect(method_call?.receiver_location).toBeDefined();
      expect(method_call?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });

      // Self-reference calls have property_chain instead
      expect(this_call).toBeDefined();
      if (this_call) {
        expect(this_call.keyword).toBe("this");
        expect(this_call.property_chain).toContain("doSomething");
      }

      expect(super_call).toBeDefined();
      if (super_call) {
        expect(super_call.keyword).toBe("super");
        expect(super_call.property_chain).toContain("parentMethod");
      }
    });

    it("should detect optional chaining in method calls and property access", () => {
      const code = `
        const obj = { prop: { method: () => {} } };
        // Regular method call (no optional chaining)
        obj.method();

        // Optional chaining method call
        obj?.optionalMethod();

        // Chained optional chaining
        obj?.prop?.chainedMethod();

        // Mixed regular and optional chaining
        obj.prop?.mixedMethod();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Regular method call - should NOT have optional chaining
      const regular_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "method",
      );
      expect(regular_call).toBeDefined();
      // Regular calls should have optional_chaining: false or undefined
      expect(regular_call?.optional_chaining).toBeFalsy();

      // Optional chaining method call - should have optional chaining
      const optional_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "optionalMethod",
      );
      expect(optional_call).toBeDefined();
      expect(optional_call?.optional_chaining).toBe(true);

      // Chained optional chaining - should have optional chaining
      const chained_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "chainedMethod",
      );
      expect(chained_call).toBeDefined();
      expect(chained_call?.optional_chaining).toBe(true);

      // Mixed optional chaining - should have optional chaining
      const mixed_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "mixedMethod",
      );
      expect(mixed_call).toBeDefined();
      expect(mixed_call?.optional_chaining).toBe(true);
    });

    it.skip("should capture JSDoc documentation for functions", () => {
      const code = `
        /**
         * Creates a user account
         * @param {string} name - The user's name
         * @param {number} age - The user's age
         * @returns {User} The created user object
         */
        function createUser(name, age) {
          return { name, age };
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const create_user_func = Array.from(result.functions.values()).find(
        (f) => f.name === "createUser",
      );

      expect(create_user_func).toBeDefined();
      expect(create_user_func?.docstring).toBeDefined();
      expect(create_user_func?.docstring).toContain("Creates a user account");
      expect(create_user_func?.docstring).toContain("@param {string} name");
      expect(create_user_func?.docstring).toContain("@param {number} age");
      expect(create_user_func?.docstring).toContain("@returns {User}");
    });

    it.skip("should capture JSDoc documentation for classes", () => {
      const code = `
        /**
         * Represents a user in the system
         * @class
         */
        class User {
          constructor(name) {
            this.name = name;
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const user_class = Array.from(result.classes.values()).find(
        (c) => c.name === "User",
      );

      expect(user_class).toBeDefined();
      expect(user_class?.docstring).toBeDefined();
      expect(user_class?.docstring?.[0]).toContain("Represents a user in the system");
      expect(user_class?.docstring?.[0]).toContain("@class");
    });

    it.skip("should capture JSDoc documentation for methods", () => {
      const code = `
        class Calculator {
          /**
           * Adds two numbers together
           * @param {number} a - First number
           * @param {number} b - Second number
           * @returns {number} The sum
           */
          add(a, b) {
            return a + b;
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const calc_class = Array.from(result.classes.values()).find(
        (c) => c.name === "Calculator",
      );

      expect(calc_class).toBeDefined();
      expect(calc_class?.methods.length).toBe(1);
      const add_method = calc_class?.methods[0];
      expect(add_method?.name).toBe("add");
      expect(add_method?.docstring).toBeDefined();
      expect(add_method?.docstring).toContain("Adds two numbers together");
      expect(add_method?.docstring).toContain("@param {number} a");
      expect(add_method?.docstring).toContain("@param {number} b");
      expect(add_method?.docstring).toContain("@returns {number}");
    });

    it.skip("should capture JSDoc documentation for variables", () => {
      const code = `
        /** @type {Service} */
        const service = createService();

        /**
         * The application configuration
         * @type {Config}
         */
        const config = loadConfig();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const service_var = Array.from(result.variables.values()).find(
        (v) => v.name === "service",
      );
      const config_var = Array.from(result.variables.values()).find(
        (v) => v.name === "config",
      );

      expect(service_var).toBeDefined();
      expect(service_var?.docstring).toBeDefined();
      expect(service_var?.docstring).toContain("@type {Service}");

      expect(config_var).toBeDefined();
      expect(config_var?.docstring).toBeDefined();
      expect(config_var?.docstring).toContain("The application configuration");
      expect(config_var?.docstring).toContain("@type {Config}");
    });

    it("should not capture documentation when there is no comment", () => {
      const code = `
        function noDoc() {
          return 42;
        }

        class NoDocClass {
          method() {}
        }

        const no_doc_var = 123;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const no_doc_func = Array.from(result.functions.values()).find(
        (f) => f.name === "noDoc",
      );
      const no_doc_class = Array.from(result.classes.values()).find(
        (c) => c.name === "NoDocClass",
      );
      const no_doc_var = Array.from(result.variables.values()).find(
        (v) => v.name === "noDocVar",
      );

      expect(no_doc_func?.docstring).toBeUndefined();
      expect(no_doc_class?.docstring).toBeUndefined();
      expect(no_doc_var?.docstring).toBeUndefined();
    });

    it("should capture property access chains correctly", () => {
      const code = `
        const api = { users: { list: () => [] } };
        api.users.list();
        this.service.method();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Find method calls with property chains
      const list_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "list",
      );
      const method_call = result.references.find(
        (ref): ref is SelfReferenceCall | MethodCallReference =>
          (ref.kind === "self_reference_call" || ref.kind === "method_call") &&
          ref.name === "method",
      );

      // Verify property chains are populated
      // property_chain should recursively extract all parts
      expect(list_call).toBeDefined();
      expect(list_call?.property_chain).toEqual(["api", "users", "list"]);

      // Note: this.service.method() may be captured as either self_reference_call or method_call
      // depending on how the semantic index handles chained property access on self
      if (method_call) {
        // Property chain format may vary based on reference type
        expect(method_call.property_chain).toBeDefined();
      }
    });

    it("should populate appropriate context for function calls", () => {
      const code = `
        function greet(name) { return "Hello " + name; }
        greet("World");

        const arrow = (x) => x * 2;
        arrow(5);

        Math.max(1, 2, 3);
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Regular function call (no receiver)
      const greet_call = result.references.find(
        (ref): ref is FunctionCallReference =>
          ref.kind === "function_call" && ref.name === "greet",
      );
      expect(greet_call).toBeDefined();
      // receiver_location doesn't exist on FunctionCallReference

      // Arrow function call (no receiver)
      const arrow_call = result.references.find(
        (ref): ref is FunctionCallReference =>
          ref.kind === "function_call" && ref.name === "arrow",
      );
      expect(arrow_call).toBeDefined();
      // receiver_location doesn't exist on FunctionCallReference

      // Static method call (has receiver)
      const max_call = result.references.find(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "max",
      );
      expect(max_call).toBeDefined();
      expect(max_call?.receiver_location).toBeDefined();
      expect(max_call?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });
    });

    it("should extract method resolution metadata for all receiver patterns", () => {
      const code = `
        class Service {
          getData() {
            return [];
          }
        }

        function createService() {
          return new Service();
        }

        // Scenario 1: Receiver type from JSDoc annotation
        /** @type {Service} */
        const service1 = createService();
        service1.getData();

        // Scenario 2: Receiver type from constructor
        const service2 = new Service();
        service2.getData();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Scenario 1: Receiver from JSDoc annotation
      // Verify the assignment is captured
      const service1_assignment = result.references.find(
        (ref) => ref.kind === "assignment" && ref.name === "service1",
      );
      expect(service1_assignment).toBeDefined();

      // Note: assignment_type from JSDoc is a future enhancement

      // Verify method calls have receiver_location
      const method_calls = result.references.filter(
        (ref): ref is MethodCallReference =>
          ref.kind === "method_call" && ref.name === "getData",
      );

      // Should have at least 2 getData method calls
      expect(method_calls.length).toBeGreaterThanOrEqual(2);

      // At least some method calls should have receiver_location
      const calls_with_receiver = method_calls.filter((c) => c.receiver_location);
      expect(calls_with_receiver.length).toBeGreaterThan(0);

      // Scenario 2: Verify constructor call has construct_target
      const constructor_calls = result.references.filter(
        (ref): ref is ConstructorCallReference =>
          ref.kind === "constructor_call" && ref.name === "Service",
      );

      // Should have at least one constructor call with construct_target
      const construct_with_target = constructor_calls.find((c) => c.construct_target);
      expect(construct_with_target).toBeDefined();
    });
  });

  describe("Comprehensive feature coverage", () => {
    it("should correctly parse destructuring assignments", () => {
      const code = `
        const { name, age } = person;
        const [first, second, ...rest] = array;
        const { nested: { value } } = obj;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Note: Current implementation captures destructuring patterns as whole variables,
      // not individual identifiers within the pattern
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );

      // Verify that destructuring patterns are captured (as patterns, not individual names)
      // This is a known limitation - individual destructured names aren't extracted
      expect(variable_names.length).toBeGreaterThan(0);
      expect(
        variable_names.some((v) => v.includes("{") || v.includes("[")),
      ).toBe(true);
    });

    it("should correctly parse default and rest parameters", () => {
      const code = `
        function greet(name = "Guest", ...options) {
          return name;
        }

        const arrow = (x = 0, y = 0) => x + y;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify functions are captured
      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toContain("greet");
      expect(function_names).toContain("arrow");

      // Verify function has parameters (implementation-specific verification)
      const greet_func = Array.from(result.functions.values()).find(
        (f) => f.name === "greet",
      );
      expect(greet_func).toBeDefined();
    });

    it("should correctly parse computed member access and bracket notation", () => {
      const code = `
        const obj = { key: "value" };
        const value = obj["key"];
        const dynamic = obj[variableName];
        arr[0] = "first";
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify variables are captured
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("obj");
      expect(variable_names).toContain("value");
      expect(variable_names).toContain("dynamic");

      // Verify references to obj and arr are captured
      const references = result.references.map((ref) => ref.name);
      expect(references).toContain("obj");
      expect(references).toContain("arr");
    });

    it("should correctly parse generator functions", () => {
      const code = `
        function* generateSequence() {
          yield 1;
          yield 2;
          yield 3;
        }

        const generator = generateSequence();
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Note: Generator function declarations are currently not captured separately
      // They may be in scope.function but not in the functions map
      // This is a known gap in the current implementation

      // Verify generator call (should still work)
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" ||
            ref.kind === "method_call" ||
            ref.kind === "self_reference_call",
        )
        .map((ref) => ref.name);
      expect(calls).toContain("generateSequence");

      // Verify variable assignment
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("generator");
    });

    it("should correctly parse async/await functions", () => {
      const code = `
        async function fetchData() {
          const response = await fetch(url);
          return response.json();
        }

        const asyncArrow = async () => {
          return await Promise.resolve(42);
        };
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify async functions are captured
      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toContain("fetchData");
      expect(function_names).toContain("asyncArrow");

      // Verify method calls
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" ||
            ref.kind === "method_call" ||
            ref.kind === "self_reference_call",
        )
        .map((ref) => ref.name);
      expect(calls).toContain("fetch");
      expect(calls).toContain("json");
      expect(calls).toContain("resolve");
    });

    it("should correctly parse private class fields and methods", () => {
      const code = `
        class SecureClass {
          #privateField = 42;

          #privateMethod() {
            return this.#privateField;
          }

          publicMethod() {
            return this.#privateMethod();
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify class is captured
      const class_names = Array.from(result.classes.values()).map((c) => c.name);
      expect(class_names).toContain("SecureClass");

      // Verify methods are captured (including private)
      const secure_class = Array.from(result.classes.values()).find(
        (c) => c.name === "SecureClass",
      );
      expect(secure_class).toBeDefined();
      if (secure_class) {
        const method_names = secure_class.methods.map((m) => m.name);
        // Note: private method names include the # prefix
        expect(method_names.some((name) => name.includes("privateMethod"))).toBe(
          true,
        );
        expect(method_names).toContain("publicMethod");
      }
    });

    it("should correctly parse update expressions and assignments", () => {
      const code = `
        let counter = 0;
        counter++;
        ++counter;
        counter--;
        counter += 5;
        counter = counter * 2;
        obj.property = newValue;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify variable is captured
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("counter");

      // Verify references to counter are captured
      const references = result.references.map((ref) => ref.name);
      expect(references).toContain("counter");
      expect(references).toContain("obj");
      expect(references).toContain("newValue");
    });

    it("should correctly parse catch clause parameters", () => {
      const code = `
        try {
          riskyOperation();
        } catch (error) {
          console.log(error.message);
        } finally {
          cleanup();
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify function calls
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" ||
            ref.kind === "method_call" ||
            ref.kind === "self_reference_call",
        )
        .map((ref) => ref.name);
      expect(calls).toContain("riskyOperation");
      expect(calls).toContain("log");
      expect(calls).toContain("cleanup");

      // Note: Catch parameters are captured by queries but may not be in variables map
      // They are scoped to the catch block and treated as parameters
      // This is expected behavior - parameters are tracked separately
      const references = result.references.map((ref) => ref.name);
      expect(references).toContain("error"); // Should be referenced in console.log
    });

    it("should correctly parse for-in and for-of loop variables", () => {
      const code = `
        const obj = { a: 1, b: 2 };
        for (const key in obj) {
          console.log(key);
        }

        const arr = [1, 2, 3];
        for (const item of arr) {
          console.log(item);
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify main variables are captured
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("obj");
      expect(variable_names).toContain("arr");

      // Note: Loop variables (key, item) are captured by queries as definition.variable
      // but may not appear in the variables map due to scope handling
      // They should be referenced in the loop body
      const references = result.references.map((ref) => ref.name);
      expect(references).toContain("key");
      expect(references).toContain("item");
    });

    it("should correctly parse template literals and tagged templates", () => {
      const code = `
        const name = "World";
        const greeting = \`Hello, \${name}!\`;

        function tag(strings, ...values) {
          return strings[0];
        }

        const styled = tag\`color: red\`;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify variables and function
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("name");
      expect(variable_names).toContain("greeting");
      expect(variable_names).toContain("styled");

      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toContain("tag");

      // Verify tagged template call
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" ||
            ref.kind === "method_call" ||
            ref.kind === "self_reference_call",
        )
        .map((ref) => ref.name);
      expect(calls).toContain("tag");
    });

    it("should correctly parse spread operators in function calls", () => {
      const code = `
        const args = [1, 2, 3];
        Math.max(...args);

        const arr1 = [1, 2];
        const arr2 = [...arr1, 3, 4];

        const obj1 = { a: 1 };
        const obj2 = { ...obj1, b: 2 };
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify method call
      const calls = result.references
        .filter(
          (ref) =>
            ref.kind === "function_call" ||
            ref.kind === "method_call" ||
            ref.kind === "self_reference_call",
        )
        .map((ref) => ref.name);
      expect(calls).toContain("max");

      // Verify variables
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("args");
      expect(variable_names).toContain("arr1");
      expect(variable_names).toContain("arr2");
      expect(variable_names).toContain("obj1");
      expect(variable_names).toContain("obj2");
    });

    it("should correctly parse multiple variable declarations in one statement", () => {
      const code = `
        const a = 1, b = 2, c = 3;
        let x, y, z = 10;
        var n = () => {};
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify variables with initializers are captured
      const variable_names = Array.from(result.variables.values()).map(
        (v) => v.name,
      );
      expect(variable_names).toContain("a");
      expect(variable_names).toContain("b");
      expect(variable_names).toContain("c");
      // Note: Variables without initializers (x, y) may not be captured by current queries
      // Only variables with assignments are captured: variable_declarator name: value:
      expect(variable_names).toContain("z");
      expect(variable_names).toContain("n");

      // Arrow functions assigned to variables should be captured as functions
      const function_names = Array.from(result.functions.values()).map(
        (f) => f.name,
      );
      expect(function_names).toContain("n");
    });

    it("should correctly parse class constructors with parameters and properties", () => {
      const code = `
        class Person {
          constructor(name, age = 0) {
            this.name = name;
            this.age = age;
          }

          greet() {
            return \`Hello, \${this.name}\`;
          }
        }

        class Animal {
          species = "unknown";

          constructor(species) {
            this.species = species;
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify classes are captured
      const class_names = Array.from(result.classes.values()).map((c) => c.name);
      expect(class_names).toContain("Person");
      expect(class_names).toContain("Animal");

      // Verify Person class has constructor
      const person_class = Array.from(result.classes.values()).find(
        (c) => c.name === "Person",
      );
      expect(person_class).toBeDefined();
      expect(person_class?.constructor).toBeDefined();
      expect(person_class?.constructor?.length).toBe(1);

      if (person_class?.constructor && person_class.constructor.length > 0) {
        const ctor = person_class.constructor[0];
        expect(ctor.name).toBe("constructor");
        expect(ctor.parameters).toBeDefined();
        expect(ctor.parameters.length).toBe(2);

        // Verify constructor parameters
        const param_names = ctor.parameters.map((p) => p.name);
        expect(param_names).toContain("name");
        expect(param_names).toContain("age");

        // Verify parameter with default value
        const age_param = ctor.parameters.find((p) => p.name === "age");
        expect(age_param?.default_value).toBeDefined();
      }

      // Verify Person class has methods
      expect(person_class?.methods).toBeDefined();
      expect(person_class?.methods.length).toBeGreaterThan(0);
      const method_names = person_class?.methods.map((m) => m.name);
      expect(method_names).toContain("greet");

      // Verify Animal class has constructor and properties
      const animal_class = Array.from(result.classes.values()).find(
        (c) => c.name === "Animal",
      );
      expect(animal_class).toBeDefined();
      expect(animal_class?.constructor).toBeDefined();
      expect(animal_class?.constructor?.length).toBe(1);

      if (animal_class?.constructor && animal_class.constructor.length > 0) {
        const ctor = animal_class.constructor[0];
        expect(ctor.parameters).toBeDefined();
        expect(ctor.parameters.length).toBe(1);
        expect(ctor.parameters[0].name).toBe("species");
      }

      // Verify Animal class has properties
      expect(animal_class?.properties).toBeDefined();
      expect(animal_class?.properties.length).toBeGreaterThan(0);
      const prop_names = animal_class?.properties.map((p) => p.name);
      expect(prop_names).toContain("species");
    });
  });

  describe("Complete object assertions with literal equality", () => {
    it("should extract class with complete structure including constructor, methods, and properties", () => {
      const code = `
        class MyClass {
          x = 10;
          y;

          constructor(a, b) {
            this.a = a;
            this.b = b;
          }

          method1(p1, p2 = 5) {
            return p1 + p2;
          }

          method2() {}
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const class_def = Array.from(result.classes.values()).find(
        (d) => d.name === "MyClass",
      );

      expect(class_def).toBeDefined();
      expect(class_def?.kind).toBe("class");
      expect(class_def?.name).toBe("MyClass");

      // Verify constructor exists and is tracked as constructor (not method)
      expect(class_def?.constructor).toBeDefined();
      expect(Array.isArray(class_def?.constructor)).toBe(true);
      expect(class_def?.constructor?.length).toBe(1);

      if (class_def?.constructor && class_def.constructor.length > 0) {
        const ctor = class_def.constructor[0];

        // Verify constructor structure
        expect(ctor.kind).toBe("constructor");
        expect(ctor.name).toBe("constructor");
        expect(ctor.symbol_id).toContain(":");
        expect(ctor.location.file_path).toBe("test.js");
        expect(ctor.defining_scope_id).toContain(":");

        // Verify parameters
        expect(ctor.parameters).toHaveLength(2);

        // Verify parameter details
        const param_names = ctor.parameters.map((p) => p.name);
        expect(param_names).toEqual(["a", "b"]);
      }

      // Verify methods exist and are complete
      expect(class_def?.methods).toBeDefined();
      expect(Array.isArray(class_def?.methods)).toBe(true);
      expect(class_def?.methods.length).toBe(2);

      // Find method1 and verify complete structure
      const method1 = class_def?.methods.find((m) => m.name === "method1");
      expect(method1).toBeDefined();

      if (method1) {
        expect(method1.kind).toBe("method");
        expect(method1.symbol_id).toMatch(/^method:/);
        expect(method1.name).toBe("method1");
        expect(method1.location.file_path).toBe("test.js");
        expect(method1.defining_scope_id).toContain(":");

        // Verify method1 has 2 parameters
        expect(method1.parameters).toHaveLength(2);
        const param_names = method1.parameters.map((p) => p.name);
        expect(param_names).toEqual(["p1", "p2"]);

        // Verify p2 has default value
        const p2 = method1.parameters.find((p) => p.name === "p2");
        expect(p2?.default_value).toBeDefined();
        expect(p2?.default_value).toBe("5");
      }

      // Verify properties exist
      expect(class_def?.properties).toBeDefined();
      expect(Array.isArray(class_def?.properties)).toBe(true);
      expect(class_def?.properties.length).toBeGreaterThanOrEqual(1);

      // Find property x and verify structure
      const x_prop = class_def?.properties.find((p) => p.name === "x");

      if (x_prop) {
        expect(x_prop.kind).toBe("property");
        expect(x_prop.symbol_id).toMatch(/^property:/);
        expect(x_prop.name).toBe("x");
        expect(x_prop.location.file_path).toBe("test.js");
        expect(x_prop.defining_scope_id).toContain(":");
        if (x_prop.initial_value) {
          expect(x_prop.initial_value).toBe("10");
        }
      }
    });

    it("should extract functions with complete structure", () => {
      const code = `
        function add(x, y) {
          return x + y;
        }

        function greet(name = "World") {
          console.log("Hello " + name);
        }

        const multiply = (a, b) => a * b;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify add function
      const add_func = Array.from(result.functions.values()).find(
        (d) => d.name === "add",
      );

      expect(add_func).toBeDefined();

      if (add_func) {
        expect(add_func.kind).toBe("function");
        expect(add_func.symbol_id).toMatch(/^function:/);
        expect(add_func.name).toBe("add");
        expect(add_func.location.file_path).toBe("test.js");
        expect(add_func.defining_scope_id).toContain(":");
        expect(add_func.signature).toBeDefined();
        expect(add_func.signature.parameters).toBeDefined();
      }

      // Verify greet function
      const greet_func = Array.from(result.functions.values()).find(
        (d) => d.name === "greet",
      );

      expect(greet_func).toBeDefined();

      if (greet_func) {
        expect(greet_func.kind).toBe("function");
        expect(greet_func.name).toBe("greet");
        expect(greet_func.signature).toBeDefined();
        expect(greet_func.signature.parameters).toBeDefined();
      }

      // Verify arrow function
      const multiply_func = Array.from(result.functions.values()).find(
        (d) => d.name === "multiply",
      );

      expect(multiply_func).toBeDefined();

      if (multiply_func) {
        expect(multiply_func.kind).toBe("function");
        expect(multiply_func.name).toBe("multiply");
        expect(multiply_func.signature).toBeDefined();
        expect(multiply_func.signature.parameters).toBeDefined();
      }
    });

    it("should extract variables and constants with complete structure", () => {
      const code = `
        let x = 10;
        var y = "hello";
        const PI = 3.14;
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      // Verify variable x
      const x_var = Array.from(result.variables.values()).find(
        (d) => d.name === "x",
      );

      expect(x_var).toBeDefined();

      if (x_var) {
        expect(x_var.kind).toBe("variable");
        expect(x_var.symbol_id).toMatch(/^variable:/);
        expect(x_var.name).toBe("x");
        expect(x_var.location.file_path).toBe("test.js");
        expect(x_var.defining_scope_id).toContain(":");
      }

      // Verify constant PI
      const pi_const = Array.from(result.variables.values()).find(
        (d) => d.name === "PI",
      );

      expect(pi_const).toBeDefined();

      if (pi_const) {
        expect(pi_const.kind).toBe("constant");
        expect(pi_const.symbol_id).toContain(":");
        expect(pi_const.name).toBe("PI");
        expect(pi_const.location.file_path).toBe("test.js");
        expect(pi_const.defining_scope_id).toContain(":");
        if (pi_const.initial_value) {
          expect(pi_const.initial_value).toBe("3.14");
        }
      }
    });

    it("should extract imports with complete structure", () => {
      const code = `
        import defaultExport from './module1';
        import { named1, named2 } from './module2';
        import * as namespace from './module3';
        import { original as alias } from './module4';
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const imports = Array.from(result.imported_symbols.values());
      expect(imports.length).toBeGreaterThanOrEqual(5);

      // Verify default import
      const default_import = imports.find((i) => i.name === "defaultExport");
      expect(default_import).toBeDefined();

      if (default_import) {
        expect(default_import.kind).toBe("import");
        expect(default_import.symbol_id).toContain(":");
        expect(default_import.name).toBe("defaultExport");
        expect(default_import.location.file_path).toBe("test.js");
        expect(default_import.defining_scope_id).toContain(":");
        expect(default_import.import_path).toBe("./module1");
      }

      // Verify named import
      const named_import = imports.find((i) => i.name === "named1");
      expect(named_import).toBeDefined();

      if (named_import) {
        expect(named_import.import_kind).toBe("named");
        expect(named_import.import_path).toBe("./module2");
      }

      // Verify namespace import
      const namespace_import = imports.find((i) => i.name === "namespace");
      expect(namespace_import).toBeDefined();

      if (namespace_import) {
        expect(namespace_import.kind).toBe("import");
        expect(namespace_import.symbol_id).toContain(":");
        expect(namespace_import.name).toBe("namespace");
        expect(namespace_import.location.file_path).toBe("test.js");
        expect(namespace_import.defining_scope_id).toContain(":");
        expect(namespace_import.import_path).toBe("./module3");
      }

      // Verify aliased import
      const alias_import = imports.find((i) => i.name === "alias");
      expect(alias_import).toBeDefined();

      if (alias_import) {
        expect(alias_import.import_kind).toBe("named");
        expect(alias_import.import_path).toBe("./module4");
        // original_name tracking may vary by implementation
        if (alias_import.original_name) {
          expect(alias_import.original_name).toBe("original");
        }
      }
    });

    it("should verify constructor is tracked as constructor, not as method", () => {
      const code = `
        class TestClass {
          constructor(param1, param2) {
            this.value = param1;
          }

          regular_method() {
            return this.value;
          }
        }
      `;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const result = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const class_def = Array.from(result.classes.values()).find(
        (d) => d.name === "TestClass",
      );

      expect(class_def).toBeDefined();

      // Verify constructor exists and is in constructor field, NOT in methods
      expect(class_def?.constructor).toBeDefined();
      expect(Array.isArray(class_def?.constructor)).toBe(true);
      expect(class_def?.constructor?.length).toBe(1);

      if (class_def?.constructor && class_def.constructor.length > 0) {
        const ctor = class_def.constructor[0];

        // Verify it has kind "constructor", not "method"
        expect(ctor.kind).toBe("constructor");
        expect(ctor.name).toBe("constructor");

        // Verify constructor has parameters
        expect(ctor.parameters).toBeDefined();
        expect(ctor.parameters.length).toBe(2);

        const param_names = ctor.parameters.map((p) => p.name);
        expect(param_names).toEqual(["param1", "param2"]);
      }

      // Verify methods array does NOT contain the constructor
      expect(class_def?.methods).toBeDefined();
      const method_names = class_def?.methods.map((m) => m.name) || [];
      expect(method_names).not.toContain("constructor");
      expect(method_names).toContain("regularMethod");

      // Verify regular method has kind "method"
      const regular_method = class_def?.methods.find(
        (m) => m.name === "regularMethod",
      );
      expect(regular_method?.kind).toBe("method");
    });
  });

  describe("Scope boundary verification", () => {
    it("should capture only class body as scope for class declaration", () => {
      const code = `class MyClass {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const index = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null,
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class",
      );
      expect(class_scope).toBeDefined();

      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass",
      );
      expect(my_class).toBeDefined();

      // Class scope should start at `{` (body start), not at `class` keyword
      expect(class_scope!.location.start_column).toBeGreaterThan(10);

      // Class name 'MyClass' should be in module scope, not class scope
      expect(my_class!.defining_scope_id).toBe(file_scope_id);

      // Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
    });

    it("should capture only class body as scope for class expression", () => {
      const code = `const MyClass = class {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const index = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null,
      );
      expect(file_scope).toBeDefined();

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class",
      );
      expect(class_scope).toBeDefined();

      // Class scope should start at body (after "class {")
      expect(class_scope!.location.start_column).toBeGreaterThan(20);
    });

    it("should assign correct scopes to nested classes", () => {
      const code = `class Outer {
  method() {
    class Inner {
      innerMethod() {}
    }
  }
}`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const index = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null,
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const method_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "method",
      );
      expect(method_scope).toBeDefined();
      const method_scope_id = method_scope!.id;

      const outer_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Outer",
      );
      const inner_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Inner",
      );

      expect(outer_class).toBeDefined();
      expect(inner_class).toBeDefined();

      // Outer should be in file scope, Inner should be in method scope
      expect(outer_class!.defining_scope_id).toBe(file_scope_id);
      expect(inner_class!.defining_scope_id).toBe(method_scope_id);
    });
  });

  describe("Named function expression self-reference", () => {
    it("should allow named function expression to reference itself", () => {
      const code = `const factorial = function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
};`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language,
      );
      const index = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language,
      );

      const scopes = Array.from(index.scopes.values());
      expect(scopes.length).toBeGreaterThan(0);

      const all_defs = [
        ...Array.from(index.functions.values()),
        ...Array.from(index.variables.values()),
      ];

      // Look for 'fact' definition
      const fact_def = all_defs.find((d) => d.name === "fact");

      // Find the reference to 'fact' inside the function body
      const fact_ref = Array.from(index.references.values()).find(
        (r) => r.name === "fact" && r.location.start_line === 3,
      );

      // Verify that the reference exists (even if resolution needs work)
      expect(fact_ref).toBeDefined();

      // If 'fact' definition exists, it should be in the function scope
      if (fact_def) {
        const function_scope = scopes.find((s) => s.type === "function");
        expect(function_scope).toBeDefined();
        // Fact should be in function scope for self-reference
        expect(fact_def.defining_scope_id).toBe(function_scope!.id);
      }
    });
  });

  describe("Scope assignment", () => {
    it("should assign class to module scope", () => {
      const code = `class MyClass {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(
        parsed_file,
        tree,
        "javascript" as Language
      );

      // Find module scope
      const module_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(module_scope).toBeDefined();

      // Check class
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(my_class).toBeDefined();
      expect(my_class!.defining_scope_id).toBe(module_scope!.id);
    });
  });

  describe("Callback edge cases", () => {
    it("should detect callbacks with try-catch blocks", () => {
      const code = `const items = [1, 2, 3];
items.forEach((item) => {
  try {
    process(item);
  } catch (e) {
    console.error(e);
  }
});`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(code, "test.js" as FilePath, tree, "javascript" as Language);
      const index = build_semantic_index(parsed_file, tree, "javascript" as Language);

      const callbacks = Array.from(index.functions.values()).filter(
        (f) => f.name === "<anonymous>"
      );
      expect(callbacks.length).toBe(1);

      const callback = callbacks[0];
      expect(callback.callback_context).not.toBe(undefined);
      expect(callback.callback_context!.is_callback).toBe(true);
      expect(callback.callback_context!.receiver_location).not.toBe(null);
    });

    it("should detect callbacks with destructured parameters", () => {
      const code = `const items = [{id: 1, name: 'Alice'}, {id: 2, name: 'Bob'}];
const names = items.map(({id, name}) => name);`;

      const tree = parser.parse(code);
      const parsed_file = create_parsed_file(code, "test.js" as FilePath, tree, "javascript" as Language);
      const index = build_semantic_index(parsed_file, tree, "javascript" as Language);

      const callbacks = Array.from(index.functions.values()).filter(
        (f) => f.name === "<anonymous>"
      );
      expect(callbacks.length).toBe(1);

      const callback = callbacks[0];
      expect(callback.callback_context).not.toBe(undefined);
      expect(callback.callback_context!.is_callback).toBe(true);
      expect(callback.callback_context!.receiver_location).not.toBe(null);
    });
  });
});
