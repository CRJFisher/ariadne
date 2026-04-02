import { describe, it, expect, beforeEach } from "vitest";
import { extract_all_parameters } from "./extract_nested_definitions";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

describe("extract_all_parameters", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  describe("TypeScript", () => {
    it("should extract parameters from standalone functions", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function greet(name: string, age: number): void { console.log(name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
      expect(params.every((p) => p.kind === "parameter")).toBe(true);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        class Calculator {
          add(a: number, b: number): number { return a + b; }
          subtract(x: number, y: number): number { return x - y; }
        }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(4);
      const names = params.map((p) => p.name);
      expect(names).toContain("a");
      expect(names).toContain("b");
      expect(names).toContain("x");
      expect(names).toContain("y");
    });

    it("should extract parameters from class constructors", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "class Person { constructor(public name: string, private age: number) {} }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toContain("name");
      expect(params.map((p) => p.name)).toContain("age");
    });

    it("should extract parameters from interface methods", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        interface Repository {
          save(entity: Entity): Promise<void>;
          find(id: string): Promise<Entity | null>;
        }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toContain("entity");
      expect(params.map((p) => p.name)).toContain("id");
    });

    it("should extract parameters from all sources combined", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, `
        function helper(x: number): void {}
        class MyClass { constructor(name: string) {} method(value: string): void {} }
        interface MyInterface { process(data: any): void; }
      `);
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(4);
      const names = params.map((p) => p.name);
      expect(names).toContain("x");
      expect(names).toContain("name");
      expect(names).toContain("value");
      expect(names).toContain("data");
    });

    it("should return empty array when no parameters exist", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function noParams(): void {} class NoParams { method(): void {} }");
      expect(extract_all_parameters(project.get_index_single_file(file)!)).toEqual([]);
    });

    it("should preserve parameter type annotations", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function typed(name: string, count: number): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("string");
      expect(params.find((p) => p.name === "count")!.type).toBe("number");
    });

    it("should preserve default values", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function withDefaults(x: number = 42, y: string = \"hello\"): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("should set valid symbol_id and location on each parameter", () => {
      const file = "/test/file.ts" as FilePath;
      project.update_file(file, "function foo(bar: string): void {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id.length).toBeGreaterThan(0);
      expect(params[0]!.location.start_line).toBeGreaterThanOrEqual(0);
      expect(params[0]!.location.end_line).toBeGreaterThanOrEqual(params[0]!.location.start_line);
    });
  });

  describe("Python", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def greet(name: str, age: int) -> None:\n    print(name, age)");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "class Calculator:\n    def add(self, a: int, b: int) -> int:\n        return a + b");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(3);
      const names = params.map((p) => p.name);
      expect(names).toContain("self");
      expect(names).toContain("a");
      expect(names).toContain("b");
    });

    it("should extract parameters from constructors", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "class Person:\n    def __init__(self, name: str, age: int):\n        self.name = name\n        self.age = age");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(3);
      const names = params.map((p) => p.name);
      expect(names).toContain("self");
      expect(names).toContain("name");
      expect(names).toContain("age");
    });

    it("should extract *args and **kwargs parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def variadic(*args, **kwargs):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      const names = params.map((p) => p.name);
      expect(names).toContain("args");
      expect(names).toContain("kwargs");
    });

    it("should extract keyword-only parameters after *", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def kw_only(a: int, *, key: str, verbose: bool = False):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      const names = params.map((p) => p.name);
      expect(names).toContain("a");
      expect(names).toContain("key");
      expect(names).toContain("verbose");
    });

    it("should preserve type annotations on Python parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def typed(name: str, count: int) -> None:\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("str");
      expect(params.find((p) => p.name === "count")!.type).toBe("int");
    });

    it("should preserve default values on Python parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def with_defaults(x: int = 42, y: str = \"hello\"):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("should set valid symbol_id and location on Python parameters", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "def foo(bar: str):\n    pass");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id.length).toBeGreaterThan(0);
      expect(params[0]!.location.start_line).toBeGreaterThanOrEqual(0);
    });

    it("should extract parameters from Protocol method", () => {
      const file = "/test/file.py" as FilePath;
      project.update_file(file, "from typing import Protocol\n\nclass Drawable(Protocol):\n    def draw(self, canvas: str, color: str) -> None:\n        ...");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(3);
      expect(params.map((p) => p.name)).toEqual(["self", "canvas", "color"]);
    });
  });

  describe("JavaScript", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function greet(name, age) { console.log(name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "class Calculator { add(a, b) { return a + b; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["a", "b"]);
    });

    it("should extract parameters from constructors", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "class Person { constructor(name, age) { this.name = name; this.age = age; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract default value parameters in JavaScript", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function withDefaults(x = 42, y = \"hello\") {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "x")!.default_value).toBe("42");
      expect(params.find((p) => p.name === "y")!.default_value).toBe("\"hello\"");
    });

    it("should set valid symbol_id and location on JavaScript parameters", () => {
      const file = "/test/file.js" as FilePath;
      project.update_file(file, "function foo(bar) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id.length).toBeGreaterThan(0);
      expect(params[0]!.location.start_line).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Rust", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn greet(name: &str, age: u32) { println!(\"{} {}\", name, age); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from impl methods with &self", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Calculator;\nimpl Calculator {\n    fn add(&self, a: i32, b: i32) -> i32 { a + b }\n}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(3);
      const names = params.map((p) => p.name);
      expect(names).toContain("self");
      expect(names).toContain("a");
      expect(names).toContain("b");
    });

    it("should extract parameters from trait methods", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "trait Drawable { fn draw(&self, canvas: &Canvas); }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toContain("self");
      expect(params.map((p) => p.name)).toContain("canvas");
    });

    it("should extract &mut self parameter", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Counter { count: u32 }\nimpl Counter { fn increment(&mut self) { self.count += 1; } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.name).toBe("self");
    });

    it("should extract owned self parameter", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "struct Builder;\nimpl Builder { fn build(self) -> Builder { Builder } }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.name).toBe("self");
    });

    it("should preserve type annotations on Rust parameters", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn typed(name: String, count: usize) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.find((p) => p.name === "name")!.type).toBe("String");
      expect(params.find((p) => p.name === "count")!.type).toBe("usize");
    });

    it("should set valid symbol_id and location on Rust parameters", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn foo(bar: i32) {}");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(1);
      expect(params[0]!.symbol_id.length).toBeGreaterThan(0);
      expect(params[0]!.location.start_line).toBeGreaterThanOrEqual(0);
    });

    it("should extract parameters from generic function", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn process<T: Display>(item: T, count: usize) -> T { item }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["item", "count"]);
      expect(params.find((p) => p.name === "item")!.type).toBe("T");
      expect(params.find((p) => p.name === "count")!.type).toBe("usize");
    });

    it("should not extract pattern destructuring parameters", () => {
      const file = "/test/file.rs" as FilePath;
      project.update_file(file, "fn swap((a, b): (i32, i32)) -> (i32, i32) { (b, a) }");
      const params = extract_all_parameters(project.get_index_single_file(file)!);
      // Rust pattern destructuring parameters (e.g. (a, b): (i32, i32)) are not
      // extracted as named parameters — the tuple pattern has no single name node
      expect(params.length).toBe(0);
    });
  });
});
