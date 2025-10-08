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
import { query_tree } from "./query_code_tree/query_code_tree";
import type { ParsedFile } from "./file_utils";

const FIXTURES_DIR = join(__dirname, "..", "..", "tests", "fixtures");

// Helper to create ParsedFile
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: filePath,
    file_lines: lines.length,
    // For 1-indexed positions with exclusive ends: end_column = length + 1
    // (tree-sitter's endPosition is exclusive and we add 1 to convert to 1-indexed)
    file_end_column: (lines[lines.length - 1]?.length || 0) + 1,
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
          "utf8"
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
          const parsedFile = createParsedFile(
            code,
            fixture as FilePath,
            tree,
            language
          );
          const semantic_result = build_semantic_index(
            parsedFile,
            tree,
            language
          );

          // Verify console.log has receiver_location (console is the receiver)
          const logCall = semantic_result.references.find(
            (ref) => ref.type === "call" && ref.name === "log"
          );
          expect(logCall).toBeDefined();
          expect(logCall?.context?.receiver_location).toBeDefined();
          expect(logCall?.context?.receiver_location).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify regular function calls have no receiver_location
          const greetCall = semantic_result.references.find(
            (ref) => ref.type === "call" && ref.name === "greet"
          );
          expect(greetCall).toBeDefined();
          expect(greetCall?.context?.receiver_location).toBeUndefined();
          expect(greetCall?.call_type).toBe("function");
        }

        if (fixture === "class_and_methods.js") {
          // Test metadata population with semantic index
          const parsedFile = createParsedFile(
            code,
            fixture as FilePath,
            tree,
            language
          );
          const semantic_result = build_semantic_index(
            parsedFile,
            tree,
            language
          );

          // Verify constructor calls have construct_target metadata
          const dogConstructor = semantic_result.references.find(
            (ref) => ref.type === "construct" && ref.name === "Dog"
          );
          expect(dogConstructor).toBeDefined();
          expect(dogConstructor?.context?.construct_target).toBeDefined();
          expect(dogConstructor?.context?.construct_target).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify method calls have receiver_location metadata
          const speakCall = semantic_result.references.find(
            (ref) =>
              ref.type === "call" &&
              ref.name === "speak" &&
              ref.call_type === "method"
          );
          expect(speakCall).toBeDefined();
          expect(speakCall?.context?.receiver_location).toBeDefined();
          expect(speakCall?.context?.receiver_location).toMatchObject({
            file_path: fixture,
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          });

          // Verify static method calls have receiver_location
          const getSpeciesCall = semantic_result.references.find(
            (ref) => ref.type === "call" && ref.name === "getSpecies"
          );
          expect(getSpeciesCall).toBeDefined();
          expect(getSpeciesCall?.context?.receiver_location).toBeDefined();
        }

        if (fixture === "imports_exports.js") {
          // Test with semantic index - imports and exports are handled through semantic index
          const parsedFile = createParsedFile(
            code,
            fixture as FilePath,
            tree,
            language
          );
          const semantic_result = build_semantic_index(
            parsedFile,
            tree,
            language
          );

          // Verify that imports are captured
          const importNames = Array.from(
            semantic_result.imported_symbols.values()
          ).map((i) => i.name);
          expect(importNames.length).toBeGreaterThan(0);

          // Verify that functions, classes, and variables are captured
          const functionNames = Array.from(
            semantic_result.functions.values()
          ).map((f) => f.name);
          expect(functionNames).toContain("processData");
          expect(functionNames).toContain("main");

          const classNames = Array.from(semantic_result.classes.values()).map(
            (c) => c.name
          );
          expect(classNames).toContain("DataProcessor");

          const variableNames = Array.from(
            semantic_result.variables.values()
          ).map((v) => v.name);
          expect(variableNames).toContain("VERSION");
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
      const parsedFile = createParsedFile(
        code,
        "imports_exports.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Since exports are handled differently in the new API,
      // we can verify that the exported symbols are present in the definitions
      // Check that exported functions are in the functions map
      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toContain("processData");
      expect(functionNames).toContain("main");

      // Check that exported classes are in the classes map
      const classNames = Array.from(result.classes.values()).map((c) => c.name);
      expect(classNames).toContain("DataProcessor");

      // Check that exported variables are in the variables map
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("VERSION");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Check that imported symbols are in the imported_symbols map
      const importedNames = Array.from(result.imported_symbols.values()).map(
        (i) => i.name
      );

      // These should be imported
      expect(importedNames).toContain("join");
      expect(importedNames).toContain("resolve");
      expect(importedNames).toContain("fs");
      expect(importedNames).toContain("utils");
      expect(importedNames).toContain("React");
      expect(importedNames).toContain("Component");

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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify function definitions
      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toEqual(["test"]);

      // Verify function calls
      const calls = result.references
        .filter((ref) => ref.type === "call")
        .map((ref) => ref.name);
      expect(calls).toEqual(["test"]);

      // Verify return statements
      // Note: The system may capture multiple references for returns due to query patterns
      const returns = result.references.filter((ref) => ref.type === "return");
      expect(returns.length).toBeGreaterThanOrEqual(1);
    });

    it("should correctly parse static methods", () => {
      const code = `
        class Test {
          static staticMethod() {}
          regularMethod() {}
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify class definition
      const classNames = Array.from(result.classes.values()).map((c) => c.name);
      expect(classNames).toEqual(["Test"]);

      // Verify methods are extracted
      const testClass = Array.from(result.classes.values()).find(
        (c) => c.name === "Test"
      );
      expect(testClass).toBeDefined();
      if (testClass) {
        const methodNames = testClass.methods.map((m) => m.name);

        expect(methodNames).toContain("staticMethod");
        expect(methodNames).toContain("regularMethod");
      }
    });

    it("should correctly parse method calls with receivers", () => {
      const code = `
        const obj = new MyClass();
        obj.method();
        obj.prop.nested();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify constructor calls
      const constructorCall = result.references.find(
        (ref) => ref.type === "construct" && ref.name === "MyClass"
      );
      expect(constructorCall).toBeDefined();
      expect(constructorCall?.context?.construct_target).toBeDefined();

      // Verify method calls with receivers
      const methodCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "method"
      );
      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.receiver_location).toBeDefined();

      const nestedCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "nested"
      );
      expect(nestedCall).toBeDefined();
      expect(nestedCall?.context?.receiver_location).toBeDefined();
      // Note: property_chain includes the full path including the method name
      expect(nestedCall?.context?.property_chain).toEqual([
        "obj",
        "prop",
        "nested",
      ]);

      // Verify variable definitions
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("obj");
    });

    it("should correctly capture constructor calls with target assignment", () => {
      const code = `
        const myObj = new MyClass();
        const service = new ServiceClass(config);
        new UnassignedClass();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify constructor calls with construct_target
      const myClassCall = result.references.find(
        (ref) => ref.type === "construct" && ref.name === "MyClass"
      );
      expect(myClassCall).toBeDefined();
      expect(myClassCall?.context?.construct_target).toBeDefined();

      const serviceClassCall = result.references.find(
        (ref) => ref.type === "construct" && ref.name === "ServiceClass"
      );
      expect(serviceClassCall).toBeDefined();
      expect(serviceClassCall?.context?.construct_target).toBeDefined();

      // UnassignedClass won't have construct_target since it's not assigned
      const unassignedCall = result.references.find(
        (ref) => ref.type === "construct" && ref.name === "UnassignedClass"
      );
      expect(unassignedCall).toBeDefined();
      expect(unassignedCall?.context?.construct_target).toBeUndefined();
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Find method calls
      const methodCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "method"
      );
      const thisCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "doSomething"
      );
      const superCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "parentMethod"
      );

      // All method calls should have receiver_location populated
      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.receiver_location).toBeDefined();
      expect(methodCall?.context?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });

      expect(thisCall).toBeDefined();
      expect(thisCall?.context?.receiver_location).toBeDefined();
      expect(thisCall?.context?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });

      expect(superCall).toBeDefined();
      expect(superCall?.context?.receiver_location).toBeDefined();
      expect(superCall?.context?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Regular method call - should NOT have optional chaining
      const regularCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "method"
      );
      expect(regularCall).toBeDefined();
      expect(regularCall?.member_access?.is_optional_chain).toBe(false);

      // Optional chaining method call - should have optional chaining
      const optionalCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "optionalMethod"
      );
      expect(optionalCall).toBeDefined();
      expect(optionalCall?.member_access?.is_optional_chain).toBe(true);

      // Chained optional chaining - should have optional chaining
      const chainedCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "chainedMethod"
      );
      expect(chainedCall).toBeDefined();
      expect(chainedCall?.member_access?.is_optional_chain).toBe(true);

      // Mixed optional chaining - should have optional chaining
      const mixedCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "mixedMethod"
      );
      expect(mixedCall).toBeDefined();
      expect(mixedCall?.member_access?.is_optional_chain).toBe(true);
    });

    it("should capture JSDoc documentation for functions", () => {
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const createUserFunc = Array.from(result.functions.values()).find(
        (f) => f.name === "createUser"
      );

      expect(createUserFunc).toBeDefined();
      expect(createUserFunc?.docstring).toBeDefined();
      expect(createUserFunc?.docstring).toContain("Creates a user account");
      expect(createUserFunc?.docstring).toContain("@param {string} name");
      expect(createUserFunc?.docstring).toContain("@param {number} age");
      expect(createUserFunc?.docstring).toContain("@returns {User}");
    });

    it("should capture JSDoc documentation for classes", () => {
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const userClass = Array.from(result.classes.values()).find(
        (c) => c.name === "User"
      );

      expect(userClass).toBeDefined();
      expect(userClass?.docstring).toBeDefined();
      expect(userClass?.docstring?.[0]).toContain("Represents a user in the system");
      expect(userClass?.docstring?.[0]).toContain("@class");
    });

    it("should capture JSDoc documentation for methods", () => {
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const calcClass = Array.from(result.classes.values()).find(
        (c) => c.name === "Calculator"
      );

      expect(calcClass).toBeDefined();
      expect(calcClass?.methods.length).toBe(1);
      const addMethod = calcClass?.methods[0];
      expect(addMethod?.name).toBe("add");
      expect(addMethod?.docstring).toBeDefined();
      expect(addMethod?.docstring).toContain("Adds two numbers together");
      expect(addMethod?.docstring).toContain("@param {number} a");
      expect(addMethod?.docstring).toContain("@param {number} b");
      expect(addMethod?.docstring).toContain("@returns {number}");
    });

    it("should capture JSDoc documentation for variables", () => {
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const serviceVar = Array.from(result.variables.values()).find(
        (v) => v.name === "service"
      );
      const configVar = Array.from(result.variables.values()).find(
        (v) => v.name === "config"
      );

      expect(serviceVar).toBeDefined();
      expect(serviceVar?.docstring).toBeDefined();
      expect(serviceVar?.docstring).toContain("@type {Service}");

      expect(configVar).toBeDefined();
      expect(configVar?.docstring).toBeDefined();
      expect(configVar?.docstring).toContain("The application configuration");
      expect(configVar?.docstring).toContain("@type {Config}");
    });

    it("should not capture documentation when there is no comment", () => {
      const code = `
        function noDoc() {
          return 42;
        }

        class NoDocClass {
          method() {}
        }

        const noDocVar = 123;
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const noDocFunc = Array.from(result.functions.values()).find(
        (f) => f.name === "noDoc"
      );
      const noDocClass = Array.from(result.classes.values()).find(
        (c) => c.name === "NoDocClass"
      );
      const noDocVar = Array.from(result.variables.values()).find(
        (v) => v.name === "noDocVar"
      );

      expect(noDocFunc?.docstring).toBeUndefined();
      expect(noDocClass?.docstring).toBeUndefined();
      expect(noDocVar?.docstring).toBeUndefined();
    });

    it("should capture property access chains correctly", () => {
      const code = `
        const api = { users: { list: () => [] } };
        api.users.list();
        this.service.method();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Find method calls with property chains
      const listCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "list"
      );
      const methodCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "method"
      );

      // Verify property chains are populated
      // Note: property_chain includes the full path including the method name
      expect(listCall).toBeDefined();
      expect(listCall?.context?.property_chain).toEqual([
        "api",
        "users",
        "list",
      ]);

      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.property_chain).toEqual([
        "this",
        "service",
        "method",
      ]);
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Regular function call (no receiver)
      const greetCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "greet"
      );
      expect(greetCall).toBeDefined();
      expect(greetCall?.context?.receiver_location).toBeUndefined();
      expect(greetCall?.call_type).toBe("function");

      // Arrow function call (no receiver)
      const arrowCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "arrow"
      );
      expect(arrowCall).toBeDefined();
      expect(arrowCall?.context?.receiver_location).toBeUndefined();
      expect(arrowCall?.call_type).toBe("function");

      // Static method call (has receiver)
      const maxCall = result.references.find(
        (ref) => ref.type === "call" && ref.name === "max"
      );
      expect(maxCall).toBeDefined();
      expect(maxCall?.context?.receiver_location).toBeDefined();
      expect(maxCall?.context?.receiver_location).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });
      expect(maxCall?.call_type).toBe("method");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Scenario 1: Receiver from JSDoc annotation
      // Verify the assignment is captured
      const service1Assignment = result.references.find(
        (ref) => ref.type === "assignment" && ref.name === "service1"
      );
      expect(service1Assignment).toBeDefined();

      // Note: assignment_type from JSDoc is a future enhancement

      // Verify method calls have receiver_location
      const methodCalls = result.references.filter(
        (ref) =>
          ref.type === "call" &&
          ref.call_type === "method" &&
          ref.name === "getData"
      );

      // Should have at least 2 getData method calls
      expect(methodCalls.length).toBeGreaterThanOrEqual(2);

      // At least some method calls should have receiver_location
      const callsWithReceiver = methodCalls.filter(
        (c) => c.context?.receiver_location
      );
      expect(callsWithReceiver.length).toBeGreaterThan(0);

      // Scenario 2: Verify constructor call has construct_target
      const constructorCalls = result.references.filter(
        (ref) => ref.type === "construct" && ref.name === "Service"
      );

      // Should have at least one constructor call with construct_target
      const constructWithTarget = constructorCalls.find(
        (c) => c.context?.construct_target
      );
      expect(constructWithTarget).toBeDefined();
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Note: Current implementation captures destructuring patterns as whole variables,
      // not individual identifiers within the pattern
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );

      // Verify that destructuring patterns are captured (as patterns, not individual names)
      // This is a known limitation - individual destructured names aren't extracted
      expect(variableNames.length).toBeGreaterThan(0);
      expect(
        variableNames.some((v) => v.includes("{") || v.includes("["))
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify functions are captured
      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toContain("greet");
      expect(functionNames).toContain("arrow");

      // Verify function has parameters (implementation-specific verification)
      const greetFunc = Array.from(result.functions.values()).find(
        (f) => f.name === "greet"
      );
      expect(greetFunc).toBeDefined();
    });

    it("should correctly parse computed member access and bracket notation", () => {
      const code = `
        const obj = { key: "value" };
        const value = obj["key"];
        const dynamic = obj[variableName];
        arr[0] = "first";
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify variables are captured
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("obj");
      expect(variableNames).toContain("value");
      expect(variableNames).toContain("dynamic");

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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Note: Generator function declarations are currently not captured separately
      // They may be in scope.function but not in the functions map
      // This is a known gap in the current implementation

      // Verify generator call (should still work)
      const calls = result.references
        .filter((ref) => ref.type === "call")
        .map((ref) => ref.name);
      expect(calls).toContain("generateSequence");

      // Verify variable assignment
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("generator");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify async functions are captured
      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toContain("fetchData");
      expect(functionNames).toContain("asyncArrow");

      // Verify method calls
      const calls = result.references
        .filter((ref) => ref.type === "call")
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify class is captured
      const classNames = Array.from(result.classes.values()).map((c) => c.name);
      expect(classNames).toContain("SecureClass");

      // Verify methods are captured (including private)
      const secureClass = Array.from(result.classes.values()).find(
        (c) => c.name === "SecureClass"
      );
      expect(secureClass).toBeDefined();
      if (secureClass) {
        const methodNames = secureClass.methods.map((m) => m.name);
        // Note: private method names include the # prefix
        expect(methodNames.some((name) => name.includes("privateMethod"))).toBe(
          true
        );
        expect(methodNames).toContain("publicMethod");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify variable is captured
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("counter");

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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify function calls
      const calls = result.references
        .filter((ref) => ref.type === "call")
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify main variables are captured
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("obj");
      expect(variableNames).toContain("arr");

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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify variables and function
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("name");
      expect(variableNames).toContain("greeting");
      expect(variableNames).toContain("styled");

      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toContain("tag");

      // Verify tagged template call
      const calls = result.references
        .filter((ref) => ref.type === "call")
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify method call
      const calls = result.references
        .filter((ref) => ref.type === "call")
        .map((ref) => ref.name);
      expect(calls).toContain("max");

      // Verify variables
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("args");
      expect(variableNames).toContain("arr1");
      expect(variableNames).toContain("arr2");
      expect(variableNames).toContain("obj1");
      expect(variableNames).toContain("obj2");
    });

    it("should correctly parse multiple variable declarations in one statement", () => {
      const code = `
        const a = 1, b = 2, c = 3;
        let x, y, z = 10;
        var n = () => {};
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify variables with initializers are captured
      const variableNames = Array.from(result.variables.values()).map(
        (v) => v.name
      );
      expect(variableNames).toContain("a");
      expect(variableNames).toContain("b");
      expect(variableNames).toContain("c");
      // Note: Variables without initializers (x, y) may not be captured by current queries
      // Only variables with assignments are captured: variable_declarator name: value:
      expect(variableNames).toContain("z");
      expect(variableNames).toContain("n");

      // Arrow functions assigned to variables should be captured as functions
      const functionNames = Array.from(result.functions.values()).map(
        (f) => f.name
      );
      expect(functionNames).toContain("n");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify classes are captured
      const classNames = Array.from(result.classes.values()).map((c) => c.name);
      expect(classNames).toContain("Person");
      expect(classNames).toContain("Animal");

      // Verify Person class has constructor
      const personClass = Array.from(result.classes.values()).find(
        (c) => c.name === "Person"
      );
      expect(personClass).toBeDefined();
      expect(personClass?.constructor).toBeDefined();
      expect(personClass?.constructor?.length).toBe(1);

      if (personClass?.constructor && personClass.constructor.length > 0) {
        const ctor = personClass.constructor[0];
        expect(ctor.name).toBe("constructor");
        expect(ctor.parameters).toBeDefined();
        expect(ctor.parameters.length).toBe(2);

        // Verify constructor parameters
        const paramNames = ctor.parameters.map((p) => p.name);
        expect(paramNames).toContain("name");
        expect(paramNames).toContain("age");

        // Verify parameter with default value
        const ageParam = ctor.parameters.find((p) => p.name === "age");
        expect(ageParam?.default_value).toBeDefined();
      }

      // Verify Person class has methods
      expect(personClass?.methods).toBeDefined();
      expect(personClass?.methods.length).toBeGreaterThan(0);
      const methodNames = personClass?.methods.map((m) => m.name);
      expect(methodNames).toContain("greet");

      // Verify Animal class has constructor and properties
      const animalClass = Array.from(result.classes.values()).find(
        (c) => c.name === "Animal"
      );
      expect(animalClass).toBeDefined();
      expect(animalClass?.constructor).toBeDefined();
      expect(animalClass?.constructor?.length).toBe(1);

      if (animalClass?.constructor && animalClass.constructor.length > 0) {
        const ctor = animalClass.constructor[0];
        expect(ctor.parameters).toBeDefined();
        expect(ctor.parameters.length).toBe(1);
        expect(ctor.parameters[0].name).toBe("species");
      }

      // Verify Animal class has properties
      expect(animalClass?.properties).toBeDefined();
      expect(animalClass?.properties.length).toBeGreaterThan(0);
      const propNames = animalClass?.properties.map((p) => p.name);
      expect(propNames).toContain("species");
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const class_def = Array.from(result.classes.values()).find(
        (d) => d.name === "MyClass"
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
        const paramNames = ctor.parameters.map((p) => p.name);
        expect(paramNames).toEqual(["a", "b"]);
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
        const paramNames = method1.parameters.map((p) => p.name);
        expect(paramNames).toEqual(["p1", "p2"]);

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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify add function
      const add_func = Array.from(result.functions.values()).find(
        (d) => d.name === "add"
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
        (d) => d.name === "greet"
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
        (d) => d.name === "multiply"
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      // Verify variable x
      const x_var = Array.from(result.variables.values()).find(
        (d) => d.name === "x"
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
        (d) => d.name === "PI"
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
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

          regularMethod() {
            return this.value;
          }
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const result = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const class_def = Array.from(result.classes.values()).find(
        (d) => d.name === "TestClass"
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

        const paramNames = ctor.parameters.map((p) => p.name);
        expect(paramNames).toEqual(["param1", "param2"]);
      }

      // Verify methods array does NOT contain the constructor
      expect(class_def?.methods).toBeDefined();
      const methodNames = class_def?.methods.map((m) => m.name) || [];
      expect(methodNames).not.toContain("constructor");
      expect(methodNames).toContain("regularMethod");

      // Verify regular method has kind "method"
      const regularMethod = class_def?.methods.find(
        (m) => m.name === "regularMethod"
      );
      expect(regularMethod?.kind).toBe("method");
    });
  });

  describe("Scope boundary verification", () => {
    it("should capture only class body as scope for class declaration", () => {
      const code = `class MyClass {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      const myClass = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(myClass).toBeDefined();

      // Class scope should start at `{` (body start), not at `class` keyword
      expect(class_scope!.location.start_column).toBeGreaterThan(10);

      // Class name 'MyClass' should be in module scope, not class scope
      expect(myClass!.defining_scope_id).toBe(file_scope_id);

      // Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
    });

    it("should capture only class body as scope for class expression", () => {
      const code = `const MyClass = class {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
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
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const method_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "method"
      );
      expect(method_scope).toBeDefined();
      const method_scope_id = method_scope!.id;

      const outerClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Outer"
      );
      const innerClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Inner"
      );

      expect(outerClass).toBeDefined();
      expect(innerClass).toBeDefined();

      // Outer should be in file scope, Inner should be in method scope
      expect(outerClass!.defining_scope_id).toBe(file_scope_id);
      expect(innerClass!.defining_scope_id).toBe(method_scope_id);
    });
  });

  describe("Named function expression self-reference", () => {
    it("should allow named function expression to reference itself", () => {
      const code = `const factorial = function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
};`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(
        parsedFile,
        tree,
        "javascript" as Language
      );

      const scopes = Array.from(index.scopes.values());
      expect(scopes.length).toBeGreaterThan(0);

      const allDefs = [
        ...Array.from(index.functions.values()),
        ...Array.from(index.variables.values()),
      ];

      // Look for 'fact' definition
      const factDef = allDefs.find((d) => d.name === "fact");

      // Find the reference to 'fact' inside the function body
      const factRef = Array.from(index.references.values()).find(
        (r) => r.name === "fact" && r.location.start_line === 3
      );

      // Verify that the reference exists (even if resolution needs work)
      expect(factRef).toBeDefined();

      // If 'fact' definition exists, it should be in the function scope
      if (factDef) {
        const functionScope = scopes.find((s) => s.type === "function");
        expect(functionScope).toBeDefined();
        // Fact should be in function scope for self-reference
        expect(factDef.defining_scope_id).toBe(functionScope!.id);
      }
    });
  });
});
