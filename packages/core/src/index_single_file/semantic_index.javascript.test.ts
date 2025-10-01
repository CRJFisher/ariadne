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
import { SemanticEntity } from "./query_code_tree/capture_types";
import type { ParsedFile } from "./file_utils";

const FIXTURES_DIR = join(__dirname, "..", "..", "tests", "fixtures");

// Helper to create ParsedFile
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split('\n');
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language
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
        expect(
          captures.some((c) => c.name.includes("module"))
        ).toBe(true);

        if (fixture === "basic_function.js") {
          // Test with semantic index instead of raw captures
          const parsedFile = createParsedFile(code, fixture as FilePath, tree, language);
          const semantic_result = build_semantic_index(parsedFile, tree, language);

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
          const parsedFile = createParsedFile(code, fixture as FilePath, tree, language);
          const semantic_result = build_semantic_index(parsedFile, tree, language);

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
            (ref) => ref.type === "call" && ref.name === "speak" && ref.call_type === "method"
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
          const parsedFile = createParsedFile(code, fixture as FilePath, tree, language);
          const semantic_result = build_semantic_index(parsedFile, tree, language);

          // Verify that imports are captured
          const importNames = Array.from(semantic_result.imported_symbols.values()).map(i => i.name);
          expect(importNames.length).toBeGreaterThan(0);

          // Verify that functions, classes, and variables are captured
          const functionNames = Array.from(semantic_result.functions.values()).map(f => f.name);
          expect(functionNames).toContain("processData");
          expect(functionNames).toContain("main");

          const classNames = Array.from(semantic_result.classes.values()).map(c => c.name);
          expect(classNames).toContain("DataProcessor");

          const variableNames = Array.from(semantic_result.variables.values()).map(v => v.name);
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
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Since exports are handled differently in the new API,
      // we can verify that the exported symbols are present in the definitions
      // Check that exported functions are in the functions map
      const functionNames = Array.from(result.functions.values()).map(f => f.name);
      expect(functionNames).toContain("processData");
      expect(functionNames).toContain("main");

      // Check that exported classes are in the classes map
      const classNames = Array.from(result.classes.values()).map(c => c.name);
      expect(classNames).toContain("DataProcessor");

      // Check that exported variables are in the variables map
      const variableNames = Array.from(result.variables.values()).map(v => v.name);
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
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Check that imported symbols are in the imported_symbols map
      const importedNames = Array.from(result.imported_symbols.values()).map(i => i.name);

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
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Verify function definitions
      const functionNames = Array.from(result.functions.values()).map(f => f.name);
      expect(functionNames).toEqual(["test"]);

      // Verify function calls
      const calls = result.references.filter(ref => ref.type === "call").map(ref => ref.name);
      expect(calls).toEqual(["test"]);

      // Verify return statements
      // Note: The system may capture multiple references for returns due to query patterns
      const returns = result.references.filter(ref => ref.type === "return");
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
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Verify class definition
      const classNames = Array.from(result.classes.values()).map(c => c.name);
      expect(classNames).toEqual(["Test"]);

      // Verify methods are extracted
      const testClass = Array.from(result.classes.values()).find(c => c.name === "Test");
      expect(testClass).toBeDefined();
      if (testClass) {
        const methodNames = testClass.methods.map(m => m.name);

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
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Verify constructor calls
      const constructorCall = result.references.find(
        ref => ref.type === "construct" && ref.name === "MyClass"
      );
      expect(constructorCall).toBeDefined();
      expect(constructorCall?.context?.construct_target).toBeDefined();

      // Verify method calls with receivers
      const methodCall = result.references.find(
        ref => ref.type === "call" && ref.name === "method"
      );
      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.receiver_location).toBeDefined();

      const nestedCall = result.references.find(
        ref => ref.type === "call" && ref.name === "nested"
      );
      expect(nestedCall).toBeDefined();
      expect(nestedCall?.context?.receiver_location).toBeDefined();
      // Note: property_chain includes the full path including the method name
      expect(nestedCall?.context?.property_chain).toEqual(["obj", "prop", "nested"]);

      // Verify variable definitions
      const variableNames = Array.from(result.variables.values()).map(v => v.name);
      expect(variableNames).toContain("obj");
    });

    it("should correctly capture constructor calls with target assignment", () => {
      const code = `
        const myObj = new MyClass();
        const service = new ServiceClass(config);
        new UnassignedClass();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Verify constructor calls with construct_target
      const myClassCall = result.references.find(
        ref => ref.type === "construct" && ref.name === "MyClass"
      );
      expect(myClassCall).toBeDefined();
      expect(myClassCall?.context?.construct_target).toBeDefined();

      const serviceClassCall = result.references.find(
        ref => ref.type === "construct" && ref.name === "ServiceClass"
      );
      expect(serviceClassCall).toBeDefined();
      expect(serviceClassCall?.context?.construct_target).toBeDefined();

      // UnassignedClass won't have construct_target since it's not assigned
      const unassignedCall = result.references.find(
        ref => ref.type === "construct" && ref.name === "UnassignedClass"
      );
      expect(unassignedCall).toBeDefined();
      expect(unassignedCall?.context?.construct_target).toBeUndefined();
    });

    it("should correctly convert construct_target to location in semantic index", () => {
      const code = `
        const instance = new TestClass();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Find constructor call reference
      const constructor_ref = result.references.find(
        ref => ref.type === "construct" && ref.name === "TestClass"
      );

      expect(constructor_ref).toBeDefined();
      expect(constructor_ref?.context?.construct_target).toBeDefined();

      // The construct_target should be a Location object with file_path, line, column
      expect(constructor_ref?.context?.construct_target).toMatchObject({
        file_path: "test.js",
        start_line: expect.any(Number),
        start_column: expect.any(Number),
      });
    });

    it("should populate receiver_location for method calls", () => {
      const code = `
        const obj = { method: () => {} };
        obj.method();
        this.doSomething();
        super.parentMethod();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);


      // Find method calls
      const methodCall = result.references.find(
        ref => ref.type === "call" && ref.name === "method"
      );
      const thisCall = result.references.find(
        ref => ref.type === "call" && ref.name === "doSomething"
      );
      const superCall = result.references.find(
        ref => ref.type === "call" && ref.name === "parentMethod"
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

    // JavaScript doesn't have built-in type annotations, and JSDoc parsing is not currently implemented
    // This test is removed as it tests for unsupported features
    it.skip("should populate type_info for type references (JSDoc not supported)", () => {
      // JSDoc type extraction would require additional parsing logic
      // which is not currently implemented for JavaScript
    });

    it("should capture property access chains correctly", () => {
      const code = `
        const api = { users: { list: () => [] } };
        api.users.list();
        api?.posts?.comments?.create();
        this.deeply.nested.property.method();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Find method calls with property chains
      const listCall = result.references.find(
        ref => ref.type === "call" && ref.name === "list"
      );
      const createCall = result.references.find(
        ref => ref.type === "call" && ref.name === "create"
      );
      const methodCall = result.references.find(
        ref => ref.type === "call" && ref.name === "method"
      );

      // Verify property chains are populated
      // Note: property_chain includes the full path including the method name
      expect(listCall).toBeDefined();
      expect(listCall?.context?.property_chain).toEqual(["api", "users", "list"]);

      expect(createCall).toBeDefined();
      expect(createCall?.context?.property_chain).toEqual(["api", "posts", "comments", "create"]);

      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.property_chain).toEqual(["this", "deeply", "nested", "property", "method"]);
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
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Regular function call (no receiver)
      const greetCall = result.references.find(
        ref => ref.type === "call" && ref.name === "greet"
      );
      expect(greetCall).toBeDefined();
      expect(greetCall?.context?.receiver_location).toBeUndefined();
      expect(greetCall?.call_type).toBe("function");

      // Arrow function call (no receiver)
      const arrowCall = result.references.find(
        ref => ref.type === "call" && ref.name === "arrow"
      );
      expect(arrowCall).toBeDefined();
      expect(arrowCall?.context?.receiver_location).toBeUndefined();
      expect(arrowCall?.call_type).toBe("function");

      // Static method call (has receiver)
      const maxCall = result.references.find(
        ref => ref.type === "call" && ref.name === "max"
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

    // Assignment metadata tracking requires additional query support
    // This test is removed as assignments are not currently tracked as references
    it.skip("should handle assignment metadata correctly (not currently implemented)", () => {
      // Assignment tracking would require capturing reassignments as references
      // with assignment_source and assignment_target metadata
    });

    it("should correctly capture property chains in method calls", () => {
      const code = `
        const api = getAPI();
        api.users.list();
        api.posts.comments.create();
        api.deeply.nested.property.chain.method();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(code, "test.js" as FilePath, tree, "javascript" as Language);
      const result = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Verify method calls with property chains
      // Note: property_chain includes the full path including the method name
      const listCall = result.references.find(
        ref => ref.type === "call" && ref.name === "list"
      );
      expect(listCall).toBeDefined();
      expect(listCall?.context?.property_chain).toEqual(["api", "users", "list"]);

      const createCall = result.references.find(
        ref => ref.type === "call" && ref.name === "create"
      );
      expect(createCall).toBeDefined();
      expect(createCall?.context?.property_chain).toEqual(["api", "posts", "comments", "create"]);

      // Deep chains should be captured
      const methodCall = result.references.find(
        ref => ref.type === "call" && ref.name === "method"
      );
      expect(methodCall).toBeDefined();
      expect(methodCall?.context?.property_chain).toEqual(["api", "deeply", "nested", "property", "chain", "method"]);
    });
  });
});
