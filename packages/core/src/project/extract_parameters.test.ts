import { describe, it, expect, beforeEach } from "vitest";
import { extract_all_parameters } from "./extract_parameters";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

describe("extract_all_parameters", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  describe("TypeScript", () => {
    it("extracts parameters from standalone functions", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function greet(name: string, age: number): void { console.log(name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
      expect(params.every((p) => p.kind === "parameter")).toBe(true);
    });

    it("extracts parameters from class methods", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        class Calculator {
          add(a: number, b: number): number { return a + b; }
          subtract(x: number, y: number): number { return x - y; }
        }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["a", "b", "x", "y"]);
    });

    it("extracts parameters from class constructors", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "class Person { constructor(public name: string, private age: number) {} }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("extracts parameters from interface methods", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        interface Repository {
          save(entity: Entity): Promise<void>;
          find(id: string): Promise<Entity | null>;
        }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["entity", "id"]);
    });

    it("extracts parameters from functions, classes, and interfaces combined", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        function helper(x: number): void {}
        class MyClass { constructor(name: string) {} method(value: string): void {} }
        interface MyInterface { process(data: any): void; }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["x", "value", "name", "data"]);
    });

    it("returns empty array when no parameters exist", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function noParams(): void {} class NoParams { method(): void {} }");
      expect(extract_all_parameters(project.get_index_single_file(file)!)).toEqual([]);
    });

    it("preserves parameter type annotations", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function typed(name: string, count: number): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("string");
      expect(params.find((p) => p.name === "count")!.type).toBe("number");
    });

    it("preserves default values", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function withDefaults(x: number = 42, y: string = \"hello\"): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("sets symbol_id and location matching the parameter position", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function foo(bar: string): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id).toBe("parameter:/test/file.ts:1:14:1:16:bar");
      expect(params[0]!.location).toEqual({
        file_path: "/test/file.ts",
        start_line: 1,
        start_column: 14,
        end_line: 1,
        end_column: 16,
      });
    });

    it("extracts parameters from functions nested inside functions", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function outer(a: number): void { function inner(b: string): void {} }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["a", "b"]);
    });

    it("extracts parameters across mixed nesting of function, method, and class", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "class C { m(a: number): void { function inner(b: string): void {} } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["b", "a"]);
    });

    it("returns empty array for a file with no functions, classes, or interfaces", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "const x = 1;");
      expect(extract_all_parameters(project.get_index_single_file(file)!)).toEqual([]);
    });
  });

  describe("Python", () => {
    it("extracts parameters from functions", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def greet(name: str, age: int) -> None:\n    print(name, age)");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("extracts parameters from class methods including self", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "class Calculator:\n    def add(self, a: int, b: int) -> int:\n        return a + b");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["self", "a", "b"]);
    });

    it("extracts parameters from constructors", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "class Person:\n    def __init__(self, name: str, age: int):\n        self.name = name\n        self.age = age");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["self", "name", "age"]);
    });

    it("extracts *args and **kwargs parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def variadic(*args, **kwargs):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["args", "kwargs"]);
    });

    it("extracts keyword-only parameters after *", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def kw_only(a: int, *, key: str, verbose: bool = False):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["a", "key", "verbose"]);
    });

    it("preserves type annotations on Python parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def typed(name: str, count: int) -> None:\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("str");
      expect(params.find((p) => p.name === "count")!.type).toBe("int");
    });

    it("preserves default values on Python parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def with_defaults(x: int = 42, y: str = \"hello\"):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("sets symbol_id and location matching the parameter position", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def foo(bar: str):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id).toBe("parameter:/test/file.py:1:9:1:11:bar");
      expect(params[0]!.location).toEqual({
        file_path: "/test/file.py",
        start_line: 1,
        start_column: 9,
        end_line: 1,
        end_column: 11,
      });
    });

    it("extracts parameters from Protocol method", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "from typing import Protocol\n\nclass Drawable(Protocol):\n    def draw(self, canvas: str, color: str) -> None:\n        ...");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["self", "canvas", "color"]);
    });
  });

  describe("JavaScript", () => {
    it("extracts parameters from functions", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function greet(name, age) { console.log(name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("extracts parameters from class methods", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "class Calculator { add(a, b) { return a + b; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["a", "b"]);
    });

    it("extracts parameters from constructors", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "class Person { constructor(name, age) { this.name = name; this.age = age; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("extracts default value parameters in JavaScript", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function withDefaults(x = 42, y = \"hello\") {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("sets symbol_id and location matching the parameter position", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function foo(bar) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id).toBe("parameter:/test/file.js:1:14:1:16:bar");
      expect(params[0]!.location).toEqual({
        file_path: "/test/file.js",
        start_line: 1,
        start_column: 14,
        end_line: 1,
        end_column: 16,
      });
    });
  });

  describe("Rust", () => {
    it("extracts parameters from functions", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn greet(name: &str, age: u32) { println!(\"{} {}\", name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("extracts parameters from impl methods with &self", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Calculator;\nimpl Calculator {\n    fn add(&self, a: i32, b: i32) -> i32 { a + b }\n}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["self", "a", "b"]);
    });

    it("extracts parameters from trait methods", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "trait Drawable { fn draw(&self, canvas: &Canvas); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["self", "canvas"]);
    });

    it("extracts &mut self parameter", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Counter { count: u32 }\nimpl Counter { fn increment(&mut self) { self.count += 1; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.name).toBe("self");
    });

    it("extracts owned self parameter", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Builder;\nimpl Builder { fn build(self) -> Builder { Builder } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.name).toBe("self");
    });

    it("preserves type annotations on Rust parameters", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn typed(name: String, count: usize) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("String");
      expect(params.find((p) => p.name === "count")!.type).toBe("usize");
    });

    it("sets symbol_id and location matching the parameter position", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn foo(bar: i32) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id).toBe("parameter:/test/file.rs:1:8:1:10:bar");
      expect(params[0]!.location).toEqual({
        file_path: "/test/file.rs",
        start_line: 1,
        start_column: 8,
        end_line: 1,
        end_column: 10,
      });
    });

    it("extracts parameters from generic function", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn process<T: Display>(item: T, count: usize) -> T { item }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.map((p) => p.name)).toEqual(["item", "count"]);
      expect(params.find((p) => p.name === "item")!.type).toBe("T");
      expect(params.find((p) => p.name === "count")!.type).toBe("usize");
    });

    it("does not extract pattern destructuring parameters", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn swap((a, b): (i32, i32)) -> (i32, i32) { (b, a) }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      // A tuple-pattern parameter binds no single name node, so it yields no
      // parameter definition.
      expect(params.length).toBe(0);
    });
  });
});
