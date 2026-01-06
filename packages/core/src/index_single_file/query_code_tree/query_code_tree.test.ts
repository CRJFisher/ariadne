/**
 * Tests for query_code_tree.ts
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { query_tree } from "./query_code_tree";

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
});
