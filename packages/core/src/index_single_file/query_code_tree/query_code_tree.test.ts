/**
 * Tests for query_code_tree.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { query_tree, clear_query_cache } from "./query_code_tree";

describe("query_tree", () => {
  describe("JavaScript", () => {
    it("should return captures for JavaScript code", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("function foo() { return 1; }");

      const captures = query_tree("javascript", tree);

      expect(Array.isArray(captures)).toBe(true);
      expect(captures.length).toBeGreaterThan(0);
    });

    it("should capture function definitions", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("function myFunction() {}");

      const captures = query_tree("javascript", tree);
      const capture_names = captures.map((c) => c.name);

      expect(capture_names).toContain("definition.function");
    });

    it("should capture class definitions", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("class MyClass {}");

      const captures = query_tree("javascript", tree);
      const capture_names = captures.map((c) => c.name);

      expect(capture_names).toContain("definition.class");
    });
  });

  describe("TypeScript", () => {
    it("should return captures for TypeScript code", () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const tree = parser.parse("function foo(): number { return 1; }");

      const captures = query_tree("typescript", tree);

      expect(Array.isArray(captures)).toBe(true);
      expect(captures.length).toBeGreaterThan(0);
    });

    it("should capture interface definitions", () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const tree = parser.parse("interface MyInterface { name: string; }");

      const captures = query_tree("typescript", tree);
      const capture_names = captures.map((c) => c.name);

      expect(capture_names).toContain("definition.interface");
    });
  });

  describe("Python", () => {
    it("should return captures for Python code", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const tree = parser.parse("def foo():\n    return 1");

      const captures = query_tree("python", tree);

      expect(Array.isArray(captures)).toBe(true);
      expect(captures.length).toBeGreaterThan(0);
    });

    it("should capture function definitions", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const tree = parser.parse("def my_function():\n    pass");

      const captures = query_tree("python", tree);
      const capture_names = captures.map((c) => c.name);

      expect(capture_names).toContain("definition.function");
    });
  });

  describe("Rust", () => {
    it("should return captures for Rust code", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const tree = parser.parse("fn foo() -> i32 { 1 }");

      const captures = query_tree("rust", tree);

      expect(Array.isArray(captures)).toBe(true);
      expect(captures.length).toBeGreaterThan(0);
    });

    it("should capture function definitions", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const tree = parser.parse("fn my_function() {}");

      const captures = query_tree("rust", tree);
      const capture_names = captures.map((c) => c.name);

      expect(capture_names).toContain("definition.function");
    });
  });

  describe("Error Cases", () => {
    it("should throw error for unsupported language", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("const x = 1;");

      expect(() => {
        query_tree("unsupported" as any, tree);
      }).toThrow();
    });
  });

  describe("Query Caching", () => {
    beforeEach(() => {
      clear_query_cache();
    });

    it("should cache compiled queries per language", () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const tree1 = parser.parse("const x = 1;");
      const tree2 = parser.parse("const y = 2;");

      const start1 = performance.now();
      query_tree("typescript", tree1);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      query_tree("typescript", tree2);
      const time2 = performance.now() - start2;

      // Second call should be faster (cache hit skips compilation)
      // Note: First call includes ~100ms compilation, second should be < 10ms
      expect(time2).toBeLessThan(time1);
    });

    it("should compile separate queries per language", () => {
      const ts_parser = new Parser();
      ts_parser.setLanguage(TypeScript.typescript);
      const ts_tree = ts_parser.parse("const x: number = 1;");

      const py_parser = new Parser();
      py_parser.setLanguage(Python);
      const py_tree = py_parser.parse("x = 1");

      // Both should work without interference
      const ts_captures = query_tree("typescript", ts_tree);
      const py_captures = query_tree("python", py_tree);

      expect(ts_captures.length).toBeGreaterThan(0);
      expect(py_captures.length).toBeGreaterThan(0);
    });

    it("should clear cache when clear_query_cache is called", () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const tree = parser.parse("const x = 1;");

      // First call - compiles and caches
      const start1 = performance.now();
      query_tree("typescript", tree);
      const time1 = performance.now() - start1;

      // Clear the cache
      clear_query_cache();

      // Next call should recompile (cache was cleared)
      const start2 = performance.now();
      query_tree("typescript", tree);
      const time2 = performance.now() - start2;

      // Both should take similar time (both involve compilation)
      // Allow 50% tolerance for timing variations
      expect(time2).toBeGreaterThan(time1 * 0.5);
    });
  });
});
