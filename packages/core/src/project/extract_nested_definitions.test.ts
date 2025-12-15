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
      const code = `
        function greet(name: string, age: number): void {
          console.log(name, age);
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
      expect(params.every((p) => p.kind === "parameter")).toBe(true);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }

          subtract(x: number, y: number): number {
            return x - y;
          }
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(4);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("a");
      expect(param_names).toContain("b");
      expect(param_names).toContain("x");
      expect(param_names).toContain("y");
    });

    it("should extract parameters from class constructors", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        class Person {
          constructor(public name: string, private age: number) {}
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("name");
      expect(param_names).toContain("age");
    });

    it("should extract parameters from interface methods", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        interface Repository {
          save(entity: Entity): Promise<void>;
          find(id: string): Promise<Entity | null>;
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("entity");
      expect(param_names).toContain("id");
    });

    it("should extract parameters from all sources combined", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        function helper(x: number): void {}

        class MyClass {
          constructor(name: string) {}

          method(value: string): void {}
        }

        interface MyInterface {
          process(data: any): void;
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      // 1 from helper, 1 from constructor, 1 from method, 1 from interface
      expect(params.length).toBe(4);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("x");
      expect(param_names).toContain("name");
      expect(param_names).toContain("value");
      expect(param_names).toContain("data");
    });

    it("should return empty array when no parameters exist", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        function noParams(): void {}
        class NoParams {
          method(): void {}
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params).toEqual([]);
    });

    it("should preserve parameter type annotations", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        function typed(name: string, count: number): void {}
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      const name_param = params.find((p) => p.name === "name");
      const count_param = params.find((p) => p.name === "count");

      expect(name_param?.type).toBe("string");
      expect(count_param?.type).toBe("number");
    });

    it("should preserve default values", () => {
      const file = "/test/file.ts" as FilePath;
      const code = `
        function withDefaults(x: number = 42, y: string = "hello"): void {}
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      const x_param = params.find((p) => p.name === "x");
      const y_param = params.find((p) => p.name === "y");

      expect(x_param?.default_value).toBe("42");
      expect(y_param?.default_value).toBe("\"hello\"");
    });
  });

  describe("Python", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.py" as FilePath;
      const code = `
def greet(name: str, age: int) -> None:
    print(name, age)
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.py" as FilePath;
      const code = `
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      // Should have self, a, b
      expect(params.length).toBe(3);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("self");
      expect(param_names).toContain("a");
      expect(param_names).toContain("b");
    });

    it("should extract parameters from constructors", () => {
      const file = "/test/file.py" as FilePath;
      const code = `
class Person:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      // Should have self, name, age
      expect(params.length).toBe(3);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("self");
      expect(param_names).toContain("name");
      expect(param_names).toContain("age");
    });
  });

  describe("JavaScript", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.js" as FilePath;
      const code = `
        function greet(name, age) {
          console.log(name, age);
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from class methods", () => {
      const file = "/test/file.js" as FilePath;
      const code = `
        class Calculator {
          add(a, b) {
            return a + b;
          }
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["a", "b"]);
    });

    it("should extract parameters from constructors", () => {
      const file = "/test/file.js" as FilePath;
      const code = `
        class Person {
          constructor(name, age) {
            this.name = name;
            this.age = age;
          }
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });
  });

  describe("Rust", () => {
    it("should extract parameters from functions", () => {
      const file = "/test/file.rs" as FilePath;
      const code = `
        fn greet(name: &str, age: u32) {
            println!("{} {}", name, age);
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      expect(params.map((p) => p.name)).toEqual(["name", "age"]);
    });

    it("should extract parameters from impl methods", () => {
      const file = "/test/file.rs" as FilePath;
      const code = `
        struct Calculator;

        impl Calculator {
            fn add(&self, a: i32, b: i32) -> i32 {
                a + b
            }
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      // Should have self, a, b
      expect(params.length).toBe(3);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("self");
      expect(param_names).toContain("a");
      expect(param_names).toContain("b");
    });

    it("should extract parameters from trait methods", () => {
      const file = "/test/file.rs" as FilePath;
      const code = `
        trait Drawable {
            fn draw(&self, canvas: &Canvas);
        }
      `;
      project.update_file(file, code);
      const index = project.get_index_single_file(file)!;
      const params = extract_all_parameters(index);

      expect(params.length).toBe(2);
      const param_names = params.map((p) => p.name);
      expect(param_names).toContain("self");
      expect(param_names).toContain("canvas");
    });
  });
});
