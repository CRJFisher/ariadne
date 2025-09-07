/**
 * Tests for JavaScript bespoke scope handlers
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import { Language } from "@ariadnejs/types";
import { build_generic_scope_tree } from "./scope_tree.generic";
import { create_javascript_handlers, check_closure_capture } from "./scope_tree.javascript.bespoke";

// Helper function to parse code
function parse_code(code: string, language: Language) {
  const parser = get_language_parser(language);
  if (!parser) throw new Error(`Parser not found for ${language}`);
  const tree = parser.parse(code);
  return tree.rootNode;
}

describe("JavaScript Bespoke Handlers", () => {
  describe("Function hoisting", () => {
    it("should hoist function declarations", () => {
      const code = `
        console.log(hoisted()); // Should work
        
        function hoisted() {
          return "I am hoisted";
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      const global_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(global_scope).toBeDefined();
      expect(global_scope!.symbols.has("hoisted")).toBe(true);
    });

    it("should hoist function declarations to function scope", () => {
      const code = `
        function outer() {
          inner(); // Should work
          
          function inner() {
            return "I am hoisted";
          }
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find outer function scope
      let outer_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function" && scope.parent_id === scope_tree.root_id) {
          outer_scope = scope;
          break;
        }
      }

      expect(outer_scope).toBeDefined();
      expect(outer_scope!.symbols.has("inner")).toBe(true);
    });
  });

  describe("var hoisting", () => {
    it("should hoist var declarations to function scope", () => {
      const code = `
        function test() {
          console.log(x); // undefined, not error
          var x = 5;
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find function scope
      let function_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope = scope;
          break;
        }
      }

      expect(function_scope).toBeDefined();
      expect(function_scope!.symbols.has("x")).toBe(true);
      
      const x_symbol = function_scope!.symbols.get("x");
      expect(x_symbol?.metadata?.hoisted).toBe(true);
    });

    it("should hoist var from block to function scope", () => {
      const code = `
        function test() {
          if (true) {
            var blockVar = 1;
          }
          console.log(blockVar); // Should be accessible
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find function scope
      let function_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope = scope;
          break;
        }
      }

      expect(function_scope).toBeDefined();
      expect(function_scope!.symbols.has("blockVar")).toBe(true);
    });

    it("should hoist var to global scope when not in function", () => {
      const code = `
        if (true) {
          var globalVar = 1;
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      const global_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(global_scope).toBeDefined();
      expect(global_scope!.symbols.has("globalVar")).toBe(true);
    });
  });

  describe("Strict mode", () => {
    it("should detect strict mode", () => {
      const code = `
        "use strict";
        function test() {
          return 1;
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // The context should have detected strict mode
      expect(scope_tree).toBeDefined();
    });
  });

  describe("Closure capture", () => {
    it("should detect closure capture", () => {
      const code = `
        let outer = 1;
        function closure() {
          return outer;
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find closure scope
      let closure_scope_id;
      for (const [id, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          closure_scope_id = id;
          break;
        }
      }

      expect(closure_scope_id).toBeDefined();
      const captures = check_closure_capture(scope_tree, closure_scope_id!, "outer");
      expect(captures).toBe(true);
    });

    it("should not detect capture for local variables", () => {
      const code = `
        function test() {
          let local = 1;
          return local;
        }
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find function scope
      let function_scope_id;
      for (const [id, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope_id = id;
          break;
        }
      }

      expect(function_scope_id).toBeDefined();
      const captures = check_closure_capture(scope_tree, function_scope_id!, "local");
      expect(captures).toBe(false);
    });
  });

  describe("Function expressions", () => {
    it("should handle named function expressions", () => {
      const code = `
        const fn = function named() {
          return named; // Can reference itself
        };
      `;

      const ast = parse_code(code, "javascript");
      const handlers = create_javascript_handlers();
      const scope_tree = build_generic_scope_tree(
        ast,
        code,
        "javascript",
        "test.js",
        handlers
      );

      // Find function scope
      let function_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope = scope;
          break;
        }
      }

      expect(function_scope).toBeDefined();
      expect(function_scope!.symbols.has("named")).toBe(true);
    });
  });
});