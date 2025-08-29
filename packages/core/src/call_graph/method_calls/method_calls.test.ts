/**
 * Tests for method call detection across all languages
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { find_method_calls } from "./index";
import { MethodCallContext } from "./method_calls";

describe("Method Call Detection", () => {
  describe("JavaScript", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should detect simple method calls", () => {
      const source = `
        const obj = { 
          greet: function() { return 'hello'; }
        };
        obj.greet();
        console.log('test');
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      expect(calls).toHaveLength(2);
      expect(calls[0].method_name).toBe("greet");
      expect(calls[0].receiver_name).toBe("obj");
      expect(calls[1].method_name).toBe("log");
      expect(calls[1].receiver_name).toBe("console");
    });

    it("should detect chained method calls", () => {
      const source = `
        const result = str
          .trim()
          .toLowerCase()
          .split(' ');
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      expect(calls.length).toBeGreaterThanOrEqual(3);
      const methodNames = calls.map((c) => c.method_name);
      expect(methodNames).toContain("trim");
      expect(methodNames).toContain("toLowerCase");
      expect(methodNames).toContain("split");

      // At least some should be chained
      const chainedCalls = calls.filter((c) => c.is_chained_call);
      expect(chainedCalls.length).toBeGreaterThan(0);
    });

    it("should detect class method calls", () => {
      const source = `
        class Person {
          sayHello() { 
            console.log('hello');
          }
        }
        const p = new Person();
        p.sayHello();
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const sayHelloCall = calls.find((c) => c.method_name === "sayHello");
      expect(sayHelloCall).toBeDefined();
      expect(sayHelloCall?.receiver_name).toBe("p");
    });
  });

  describe("TypeScript", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should detect generic method calls", () => {
      const source = `
        const array = [1, 2, 3];
        const mapped = array.map<string>(n => n.toString());
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.ts",
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const mapCall = calls.find((c) => c.method_name === "map");
      expect(mapCall).toBeDefined();
      expect(mapCall?.receiver_name).toBe("array");
    });

    it("should detect optional chaining method calls", () => {
      const source = `
        const obj = { method: () => 'result' };
        const result = obj?.method();
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.ts",
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const methodCall = calls.find((c) => c.method_name === "method");
      expect(methodCall).toBeDefined();
    });
  });

  describe("Python", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should detect instance method calls", () => {
      const source = `
class Person:
    def greet(self):
        return "hello"

p = Person()
p.greet()
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const greetCall = calls.find((c) => c.method_name === "greet");
      expect(greetCall).toBeDefined();
      expect(greetCall?.receiver_name).toBe("p");
      expect(greetCall?.is_static_method).toBe(false);
    });

    it("should detect class method calls", () => {
      const source = `
class MyClass:
    @classmethod
    def create(cls):
        return cls()

obj = MyClass.create()
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const createCall = calls.find((c) => c.method_name === "create");
      expect(createCall).toBeDefined();
      expect(createCall?.receiver_name).toBe("MyClass");
      expect(createCall?.is_static_method).toBe(true);
    });

    it("should detect super() method calls", () => {
      const source = `
class Child(Parent):
    def __init__(self):
        super().__init__()
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const initCall = calls.find((c) => c.method_name === "__init__");
      expect(initCall).toBeDefined();
    });
  });

  describe("Rust", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should detect instance method calls", () => {
      const source = `
struct Person {
    name: String,
}

impl Person {
    fn greet(&self) -> &str {
        "hello"
    }
}

fn main() {
    let p = Person { name: String::from("Alice") };
    p.greet();
}
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const greetCall = calls.find((c) => c.method_name === "greet");
      expect(greetCall).toBeDefined();
      expect(greetCall?.receiver_name).toBe("p");
      expect(greetCall?.is_static_method).toBe(false);
    });

    it("should detect associated function calls", () => {
      const source = `
fn main() {
    let s = String::new();
    let n = Vec::<i32>::with_capacity(10);
}
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      const newCall = calls.find((c) => c.method_name === "new");
      expect(newCall).toBeDefined();
      expect(newCall?.receiver_name).toBe("String");
      expect(newCall?.is_static_method).toBe(true);

      const capacityCall = calls.find((c) => c.method_name === "with_capacity");
      expect(capacityCall).toBeDefined();
    });

    it("should detect method chaining", () => {
      const source = `
fn main() {
    let result = "hello"
        .to_string()
        .chars()
        .collect::<Vec<_>>();
}
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_method_calls(context);

      expect(calls.length).toBeGreaterThanOrEqual(3);
      const methodNames = calls.map((c) => c.method_name);
      expect(methodNames).toContain("to_string");
      expect(methodNames).toContain("chars");
      expect(methodNames).toContain("collect");
    });
  });
});
