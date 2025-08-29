/**
 * Tests for constructor call detection across all languages
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { find_constructor_calls } from "./index";
import { ConstructorCallContext } from "./constructor_calls";

describe("Constructor Call Detection", () => {
  describe("JavaScript", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should detect new expressions", () => {
      const source = `
        class Person {
          constructor(name) {
            this.name = name;
          }
        }
        const p = new Person('Alice');
        const date = new Date();
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      expect(calls).toHaveLength(2);
      expect(calls[0].constructor_name).toBe("Person");
      expect(calls[0].is_new_expression).toBe(true);
      expect(calls[0].assigned_to).toBe("p");
      expect(calls[1].constructor_name).toBe("Date");
      expect(calls[1].assigned_to).toBe("date");
    });

    it("should detect factory functions", () => {
      const source = `
        function Component() {
          return { render: () => {} };
        }
        const comp = Component();
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      // Should detect capitalized function call as potential constructor
      const componentCall = calls.find(
        (c) => c.constructor_name === "Component"
      );
      expect(componentCall).toBeDefined();
      expect(componentCall?.is_factory_method).toBe(true);
      expect(componentCall?.assigned_to).toBe("comp");
    });
  });

  describe("TypeScript", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should detect generic constructor calls", () => {
      const source = `
        class Container<T> {
          constructor(value: T) {}
        }
        const c = new Container<string>('hello');
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.ts",
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      const containerCall = calls.find(
        (c) => c.constructor_name === "Container"
      );
      expect(containerCall).toBeDefined();
      expect(containerCall?.assigned_to).toBe("c");
    });
  });

  describe("Python", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should detect class instantiation", () => {
      const source = `
class Person:
    def __init__(self, name):
        self.name = name

p = Person("Alice")
date = datetime.now()
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      const personCall = calls.find((c) => c.constructor_name === "Person");
      expect(personCall).toBeDefined();
      expect(personCall?.assigned_to).toBe("p");
      expect(personCall?.is_new_expression).toBe(false); // Python doesn't use 'new'
    });

    it("should track type assignments with self attributes", () => {
      const source = `
class MyClass:
    def __init__(self):
        self.data = DataClass()
        self.processor = Processor()
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      // Should detect constructor calls even without direct assignment
      const dataClassCall = calls.find(
        (c) => c.constructor_name === "DataClass"
      );
      const processorCall = calls.find(
        (c) => c.constructor_name === "Processor"
      );
      expect(dataClassCall).toBeDefined();
      expect(processorCall).toBeDefined();
    });
  });

  describe("Rust", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should detect Type::new() pattern", () => {
      const source = `
fn main() {
    let s = String::new();
    let v = Vec::with_capacity(10);
}
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      const stringCall = calls.find((c) => c.constructor_name === "String");
      expect(stringCall).toBeDefined();
      expect(stringCall?.assigned_to).toBe("s");
      expect(stringCall?.is_factory_method).toBe(true);

      const vecCall = calls.find((c) => c.constructor_name === "Vec");
      expect(vecCall).toBeDefined();
      expect(vecCall?.assigned_to).toBe("v");
    });

    it("should detect struct literals", () => {
      const source = `
struct Point {
    x: f64,
    y: f64,
}

fn main() {
    let p = Point { x: 1.0, y: 2.0 };
}
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      const pointCall = calls.find((c) => c.constructor_name === "Point");
      expect(pointCall).toBeDefined();
      expect(pointCall?.assigned_to).toBe("p");
      expect(pointCall?.arguments_count).toBe(2); // Two fields
    });

    it("should detect enum variant construction", () => {
      const source = `
enum Option<T> {
    Some(T),
    None,
}

fn main() {
    let x = Option::Some(5);
    let y = Some(10);
}
      `;

      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_constructor_calls(context);

      // Should detect both qualified and unqualified enum variants
      const qualifiedCall = calls.find(
        (c) => c.constructor_name === "Option::Some"
      );
      const unqualifiedCall = calls.find((c) => c.constructor_name === "Some");
      expect(qualifiedCall || unqualifiedCall).toBeDefined();
    });
  });
});
