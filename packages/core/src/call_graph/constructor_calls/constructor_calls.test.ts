/**
 * Tests for generic constructor call processor
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import {
  process_constructor_calls_generic,
  ConstructorCallContext,
  extract_constructor_name,
  find_assignment_target,
  count_constructor_arguments,
  uses_new_keyword,
  is_factory_method_pattern,
  walk_tree
} from "./constructor_calls";
import { FilePath } from "@ariadnejs/types";

describe("Generic Constructor Call Processor", () => {
  describe("process_constructor_calls_generic", () => {
    it("should detect JavaScript new expressions", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `const p = new Person('Alice');`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = process_constructor_calls_generic(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].constructor_name).toBe("Person");
      expect(calls[0].is_new_expression).toBe(true);
      expect(calls[0].assigned_to).toBe("p");
    });

    it("should detect Python class instantiation", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const source = `p = Person("Alice")`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = process_constructor_calls_generic(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].constructor_name).toBe("Person");
      expect(calls[0].is_new_expression).toBe(false);
      expect(calls[0].assigned_to).toBe("p");
    });

    it("should detect Rust struct literals", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `let p = Point { x: 1, y: 2 };`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = process_constructor_calls_generic(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].constructor_name).toBe("Point");
      expect(calls[0].arguments_count).toBe(2); // Two fields
      expect(calls[0].assigned_to).toBe("p");
    });
  });

  describe("extract_constructor_name", () => {
    it("should extract name from JavaScript new expression", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `new MyClass()`;
      const tree = parser.parse(source);
      
      // Find the new_expression node
      let newNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'new_expression') {
          newNode = node;
        }
      });

      const name = extract_constructor_name(newNode, source, "javascript");
      expect(name).toBe("MyClass");
    });

    it("should extract name from member expression", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `new namespace.MyClass()`;
      const tree = parser.parse(source);
      
      let newNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'new_expression') {
          newNode = node;
        }
      });

      const name = extract_constructor_name(newNode, source, "javascript");
      expect(name).toBe("MyClass");
    });
  });

  describe("find_assignment_target", () => {
    it("should find variable declarator assignment", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `const myVar = new Thing();`;
      const tree = parser.parse(source);
      
      let newNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'new_expression') {
          newNode = node;
        }
      });

      const target = find_assignment_target(newNode, source, "javascript");
      expect(target).toBe("myVar");
    });

    it("should find Python assignment target", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const source = `my_obj = MyClass()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call') {
          callNode = node;
        }
      });

      const target = find_assignment_target(callNode, source, "python");
      expect(target).toBe("my_obj");
    });

    it("should find Rust let binding target", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `let my_struct = MyStruct::new();`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call_expression') {
          callNode = node;
        }
      });

      const target = find_assignment_target(callNode, source, "rust");
      expect(target).toBe("my_struct");
    });
  });

  describe("count_constructor_arguments", () => {
    it("should count JavaScript constructor arguments", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `new Person("Alice", 30, true)`;
      const tree = parser.parse(source);
      
      let newNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'new_expression') {
          newNode = node;
        }
      });

      const count = count_constructor_arguments(newNode, "javascript");
      expect(count).toBe(3);
    });

    it("should count Python keyword arguments", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const source = `Person(name="Alice", age=30)`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call') {
          callNode = node;
        }
      });

      const count = count_constructor_arguments(callNode, "python");
      expect(count).toBe(2);
    });

    it("should count Rust struct fields", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `Point { x: 1, y: 2, z: 3 }`;
      const tree = parser.parse(source);
      
      let structNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'struct_expression') {
          structNode = node;
        }
      });

      const count = count_constructor_arguments(structNode, "rust");
      expect(count).toBe(3);
    });
  });

  describe("uses_new_keyword", () => {
    it("should return true for JavaScript new expressions", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `new MyClass()`;
      const tree = parser.parse(source);
      
      let newNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'new_expression') {
          newNode = node;
        }
      });

      expect(uses_new_keyword(newNode, "javascript")).toBe(true);
    });

    it("should return false for regular function calls", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = `MyClass()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call_expression') {
          callNode = node;
        }
      });

      expect(uses_new_keyword(callNode, "javascript")).toBe(false);
    });

    it("should return false for Python", () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const source = `Person()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call') {
          callNode = node;
        }
      });

      expect(uses_new_keyword(callNode, "python")).toBe(false);
    });
  });

  describe("is_factory_method_pattern", () => {
    it("should detect Rust ::new() pattern", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `String::new()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call_expression') {
          callNode = node;
        }
      });

      expect(is_factory_method_pattern(callNode, source, "rust")).toBe(true);
    });

    it("should detect Rust ::create() pattern", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `Builder::create()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call_expression') {
          callNode = node;
        }
      });

      expect(is_factory_method_pattern(callNode, source, "rust")).toBe(true);
    });

    it("should not detect regular Rust method calls", () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = `String::len()`;
      const tree = parser.parse(source);
      
      let callNode: any = null;
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'call_expression') {
          callNode = node;
        }
      });

      expect(is_factory_method_pattern(callNode, source, "rust")).toBe(false);
    });
  });
});