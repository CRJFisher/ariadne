/**
 * extract_type_bindings operates on the definition maps produced by
 * build_index_single_file, so these tests exercise it through that indexer.
 * A binding exists only where the indexer captured a type annotation: for
 * example, TypeScript top-level variable annotations are not indexed, so those
 * cases yield no binding rather than a resolved type.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/parsed_file";
import { extract_type_bindings } from "./bindings";

function create_parsed_file(
  code: string,
  file_path: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

describe("Type Bindings - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("extracts nothing from JavaScript, which carries no type annotations", () => {
    const code = `
      const user = { name: "John", age: 25 };
      function greet(name) {
        return "Hello " + name;
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });

  it("extracts nothing from JavaScript classes, which carry no member type annotations", () => {
    const code = `
      class User {
        constructor() {
          this.name = "John";
        }
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });
});

describe("Type Bindings - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("extracts parameter type annotations from functions", () => {
    const code = `
      function greet(name: string, age: number): void {
        console.log(\`Hello \${name}, age \${age}\`);
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["number", "string", "void"]);
  });

  it("keys return-type bindings to the function location and parameter bindings to parameter locations", () => {
    const code = "function greet(name: string): void {}";

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const func = Array.from(index.functions.values())[0];
    const param = func.signature.parameters[0];
    expect(bindings).toEqual(
      new Map([
        [location_key(func.location), "void"],
        [location_key(param.location), "string"],
      ])
    );
  });

  it("extracts class property type annotations", () => {
    const code = `
      class User {
        name: string;
        age: number;
        isActive: boolean;

        constructor(name: string, age: number) {
          this.name = name;
          this.age = age;
          this.isActive = true;
        }
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(5);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["boolean", "number", "number", "string", "string"]);
  });

  it("extracts method return type and parameter annotations", () => {
    const code = `
      class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }

        multiply(x: number, y: number): number {
          return x * y;
        }
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(6);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["number", "number", "number", "number", "number", "number"]);
  });

  it("extracts interface property type annotations", () => {
    const code = `
      interface User {
        id: number;
        name: string;
        email: string;
        isActive: boolean;
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(4);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["boolean", "number", "string", "string"]);
  });

  it("extracts interface method type annotations", () => {
    const code = `
      interface Calculator {
        add(a: number, b: number): number;
        subtract(x: number, y: number): number;
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(6);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["number", "number", "number", "number", "number", "number"]);
  });

  it("preserves generic and union type annotations verbatim", () => {
    const code = `
      interface Response<T> {
        data: T;
        error: Error | null;
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(2);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["Error | null", "T"]);
  });

  it("produces no binding for top-level variable annotations, which the indexer does not capture", () => {
    const code = `
      const x: number = 42;
      let name: string = "hello";
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });

  it("extracts getter/setter type annotations", () => {
    const code = `
      class User {
        private _name: string = "";
        get name(): string { return this._name; }
        set name(value: string) { this._name = value; }
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["string", "string", "string"]);
  });

  it("extracts abstract class member type annotations", () => {
    const code = `
      abstract class Shape {
        abstract area(): number;
        abstract perimeter(): number;
        color: string = "red";
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["number", "number", "string"]);
  });
});

describe("Type Bindings - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("extracts variable type annotations", () => {
    const code = `
name: str = "John"
age: int = 25
is_active: bool = True
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["bool", "int", "str"]);
  });

  it("omits variables that have no type annotation", () => {
    const code = `
x = 1
y = "hello"
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });

  it("keys a redefined name to each definition location when shadowed across scopes", () => {
    const code = `
x: int = 1
def f():
    x: str = "a"
    return x
`;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const variables = Array.from(index.variables.values());
    const outer = variables.find((v) => v.type === "int");
    const inner = variables.find((v) => v.type === "str");
    if (!outer || !inner) throw new Error("expected two annotated x definitions");
    expect(bindings).toEqual(
      new Map([
        [location_key(outer.location), "int"],
        [location_key(inner.location), "str"],
      ])
    );
  });

  it("extracts parameter and return type annotations from functions", () => {
    const code = `
def greet(name: str, age: int) -> None:
    print(f"Hello {name}, age {age}")
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["None", "int", "str"]);
  });

  it("extracts class attribute type annotations", () => {
    const code = `
class User:
    name: str
    age: int
    is_active: bool

    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
        self.is_active = True
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(5);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["bool", "int", "int", "str", "str"]);
  });

  it("extracts method parameter and return type annotations", () => {
    const code = `
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["int", "int", "int"]);
  });

  it("extracts @classmethod parameter and return types", () => {
    const code = `
class User:
    @classmethod
    def from_dict(cls, data: dict) -> "User":
        return cls()
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(2);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["\"User\"", "dict"]);
  });
});

describe("Type Bindings - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("extracts variable type annotations", () => {
    const code = `
      let name: String = String::from("John");
      let age: i32 = 25;
      let is_active: bool = true;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["String", "bool", "i32"]);
  });

  it("extracts parameter and return type annotations from functions", () => {
    const code = `
      fn greet(name: &str, age: i32) -> () {
          println!("Hello {}, age {}", name, age);
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["&str", "()", "i32"]);
  });

  it("extracts struct field type annotations", () => {
    const code = `
      struct User {
          name: String,
          age: i32,
          is_active: bool,
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(3);
    const type_values = Array.from(bindings.values()).sort();
    expect(type_values).toEqual(["String", "bool", "i32"]);
  });

  it("produces no binding for a standalone impl block, which is not indexed as a class", () => {
    const code = `
      impl Calculator {
          fn add(&self, a: i32, b: i32) -> i32 {
              a + b
          }
      }
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });
});

describe("Type Bindings - Edge Cases", () => {
  it("returns an empty map for empty definitions", () => {
    const bindings = extract_type_bindings({
      variables: new Map(),
      functions: new Map(),
      classes: new Map(),
      interfaces: new Map(),
    });

    expect(bindings.size).toBe(0);
  });

  it("returns an empty map when no definition carries a type annotation", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    const code = `
      const x = 42;
      function foo() { return x; }
      class Bar {}
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    expect(bindings.size).toBe(0);
  });
});
