/**
 * Tests for usage finder feature
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import { build_scope_tree } from "../scope_tree";
import {
  find_usages,
  find_all_references,
  find_usages_at_position,
  find_function_calls,
  find_variable_writes,
  filter_usages_by_type,
  group_usages_by_scope,
  count_usages_by_type,
} from "./index";
import { Language, Def } from "@ariadnejs/types";

describe("Usage Finder", () => {
  describe("JavaScript", () => {
    const language: Language = "javascript";
    const parser = get_language_parser(language);

    it("should find variable usages", () => {
      const code = `
        const myVar = 42;
        console.log(myVar);
        const result = myVar * 2;
        myVar.toString();
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for myVar
      const def: Def = {
        id: "def_myVar",
        kind: "definition",
        name: "myVar",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 19 } },
        symbol_id: "test.js#myVar",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find at least the console.log and multiplication usages
      expect(usages.length).toBeGreaterThanOrEqual(2);
      expect(usages.some((u) => u.usage_type === "read")).toBe(true);
    });

    it("should find function calls", () => {
      const code = `
        function myFunction() {
          return 42;
        }
        
        myFunction();
        const result = myFunction();
        const fn = myFunction;
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      const calls = find_function_calls(
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find the function call usages
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((c) => c.usage_type === "call")).toBe(true);
    });

    it("should find method calls", () => {
      const code = `
        const obj = {
          method() { return 42; }
        };
        
        obj.method();
        const result = obj.method();
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for obj
      const def: Def = {
        id: "def_obj",
        kind: "definition",
        name: "obj",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 17 } },
        symbol_id: "test.js#obj",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find method call usages
      expect(usages.length).toBeGreaterThan(0);
      expect(usages.some((u) => u.usage_type === "call")).toBe(true);
    });

    it("should find property accesses", () => {
      const code = `
        const obj = { prop: 42 };
        console.log(obj.prop);
        obj.prop = 100;
        const val = obj['prop'];
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for obj
      const def: Def = {
        id: "def_obj",
        kind: "definition",
        name: "obj",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 17 } },
        symbol_id: "test.js#obj",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find property access usages
      expect(usages.length).toBeGreaterThan(0);
      expect(usages.some((u) => u.usage_type === "read")).toBe(true);
      expect(usages.some((u) => u.usage_type === "write")).toBe(true);
    });

    it("should find constructor calls", () => {
      const code = `
        class MyClass {
          constructor() {}
        }
        
        const instance = new MyClass();
        new MyClass();
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for MyClass
      const def: Def = {
        id: "def_MyClass",
        kind: "definition",
        name: "MyClass",
        symbol_kind: "class",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 21 } },
        symbol_id: "test.js#MyClass",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find constructor call usages
      expect(usages.length).toBeGreaterThan(0);
      expect(usages.some((u) => u.usage_type === "call")).toBe(true);
    });

    it("should find destructuring usages", () => {
      const code = `
        const obj = { a: 1, b: 2 };
        const { a, b } = obj;
        
        const arr = [1, 2, 3];
        const [x, y] = arr;
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create definitions
      const obj_def: Def = {
        id: "def_obj",
        kind: "definition",
        name: "obj",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 17 } },
        symbol_id: "test.js#obj",
      };

      const arr_def: Def = {
        id: "def_arr",
        kind: "definition",
        name: "arr",
        symbol_kind: "variable",
        range: { start: { row: 4, column: 14 }, end: { row: 4, column: 17 } },
        symbol_id: "test.js#arr",
      };

      const obj_usages = find_usages(
        obj_def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );
      const arr_usages = find_usages(
        arr_def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find destructuring usages
      expect(obj_usages.length).toBeGreaterThan(0);
      expect(arr_usages.length).toBeGreaterThan(0);
    });
  });

  describe("Cross-language features", () => {
    it("should find all references to a symbol", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        const value = 42;
        console.log(value);
        const result = value * 2;
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      const refs = find_all_references(
        "value",
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find references to value
      expect(refs.length).toBeGreaterThan(0);
    });

    it("should find usages at position", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        const myVar = 42;
        console.log(myVar);
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Position of 'myVar' in console.log (row 2, column 12)
      const position = { row: 2, column: 12 };

      const usages = find_usages_at_position(
        position,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find usages of myVar
      expect(usages.length).toBeGreaterThan(0);
    });

    it("should find variable writes", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        let x = 1;
        x = 2;
        x += 3;
        x++;
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      const writes = find_variable_writes(
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find write usages
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every((w) => w.usage_type === "write")).toBe(true);
    });

    it("should filter usages by type", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        function fn() {}
        const x = fn();
        fn();
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for fn
      const def: Def = {
        id: "def_fn",
        kind: "definition",
        name: "fn",
        symbol_kind: "function",
        range: { start: { row: 1, column: 17 }, end: { row: 1, column: 19 } },
        symbol_id: "test.js#fn",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );
      const call_usages = filter_usages_by_type(usages, ["call"]);

      // Should filter to only call usages
      expect(call_usages.every((u) => u.usage_type === "call")).toBe(true);
    });

    it("should group usages by scope", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        const x = 1;
        function fn() {
          console.log(x);
          return x * 2;
        }
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for x
      const def: Def = {
        id: "def_x",
        kind: "definition",
        name: "x",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 15 } },
        symbol_id: "test.js#x",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );
      const grouped = group_usages_by_scope(usages);

      // Should group usages by their enclosing scope
      expect(grouped.size).toBeGreaterThan(0);
    });

    it("should count usages by type", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        const obj = { method() {} };
        obj.method();
        const x = obj;
        obj.prop = 1;
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Create a definition for obj
      const def: Def = {
        id: "def_obj",
        kind: "definition",
        name: "obj",
        symbol_kind: "variable",
        range: { start: { row: 1, column: 14 }, end: { row: 1, column: 17 } },
        symbol_id: "test.js#obj",
      };

      const usages = find_usages(
        def,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );
      const counts = count_usages_by_type(usages);

      // Should count usages by type
      expect(counts.read + counts.write + counts.call).toBeGreaterThan(0);
    });
  });
});
