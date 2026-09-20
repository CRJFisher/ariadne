/**
 * extract_type_bindings operates on the definition maps produced by
 * build_index_single_file, so these tests exercise it through that indexer.
 * Every case asserts both maps: an annotation lands in exactly one of the value
 * bindings and the return bindings.
 * A binding exists only where the indexer captured a type annotation: JavaScript
 * writes none outside JSDoc, so those cases yield no binding rather than a
 * resolved type.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { LANGUAGE_TO_TREESITTER_LANG } from "../../index_single_file/query_code_tree/parsers";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/parsed_file";
import { extract_type_bindings } from "./bindings";

function sorted_texts(bindings: ReadonlyMap<SymbolId, SymbolName>): string[] {
  return Array.from(bindings.values()).sort();
}

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
    source: code,
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
  });
});

describe("Type Bindings - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["number", "string"]);
    expect(sorted_texts(return_bindings)).toEqual(["void"]);
  });

  it("keys a return-type binding to the function and a parameter binding to the parameter", () => {
    const code = "function greet(name: string): void {}";

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const func = Array.from(index.functions.values())[0];
    const param = func.signature.parameters[0];
    expect(return_bindings).toEqual(new Map([[func.symbol_id, "void"]]));
    expect(value_bindings).toEqual(new Map([[param.symbol_id, "string"]]));
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["boolean", "number", "number", "string", "string"]);
    expect(return_bindings.size).toBe(0);
    const user = Array.from(index.classes.values())[0];
    for (const property of user.properties) {
      expect(value_bindings.get(property.symbol_id)).toBe(property.type);
    }
    expect(user.properties.map((property) => property.type)).toEqual(["string", "number", "boolean"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["number", "number", "number", "number"]);
    expect(sorted_texts(return_bindings)).toEqual(["number", "number"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["boolean", "number", "string", "string"]);
    expect(sorted_texts(return_bindings)).toEqual([]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["number", "number", "number", "number"]);
    expect(sorted_texts(return_bindings)).toEqual(["number", "number"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["Error | null", "T"]);
    expect(sorted_texts(return_bindings)).toEqual([]);
  });

  it("binds a top-level variable's declared annotation, whichever keyword declares it", () => {
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["number", "string"]);
    expect(return_bindings.size).toBe(0);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["string", "string"]);
    expect(sorted_texts(return_bindings)).toEqual(["string"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["string"]);
    expect(sorted_texts(return_bindings)).toEqual(["number", "number"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["bool", "int", "str"]);
    expect(sorted_texts(return_bindings)).toEqual([]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
  });

  it("keys a redefined name to each definition when shadowed across scopes", () => {
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const variables = Array.from(index.variables.values());
    const outer = variables.find((v) => v.type === "int");
    const inner = variables.find((v) => v.type === "str");
    if (!outer || !inner) throw new Error("expected two annotated x definitions");
    expect(value_bindings).toEqual(
      new Map([
        [outer.symbol_id, "int"],
        [inner.symbol_id, "str"],
      ])
    );
    expect(return_bindings.size).toBe(0);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["int", "str"]);
    expect(sorted_texts(return_bindings)).toEqual(["None"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    // A class-body annotation is both a class-scope variable and the class's
    // property, two definitions over one span; each carries its own binding.
    const user = Array.from(index.classes.values())[0];
    const init_parameters = user.constructors?.[0]?.parameters ?? [];
    const variable_id = (name: string): SymbolId =>
      Array.from(index.variables.values()).find((v) => v.name === name)!.symbol_id;
    const property_id = (name: string): SymbolId =>
      user.properties.find((p) => p.name === name)!.symbol_id;
    const parameter_id = (name: string): SymbolId =>
      init_parameters.find((p) => p.name === name)!.symbol_id;
    expect(value_bindings).toEqual(
      new Map<SymbolId, string>([
        [variable_id("name"), "str"],
        [variable_id("age"), "int"],
        [variable_id("is_active"), "bool"],
        [property_id("name"), "str"],
        [property_id("age"), "int"],
        [property_id("is_active"), "bool"],
        [parameter_id("name"), "str"],
        [parameter_id("age"), "int"],
      ])
    );
    expect(sorted_texts(value_bindings)).toEqual([
      "bool", "bool", "int", "int", "int", "str", "str", "str",
    ]);
    expect(return_bindings.size).toBe(0);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["int", "int"]);
    expect(sorted_texts(return_bindings)).toEqual(["int"]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["dict"]);
    expect(sorted_texts(return_bindings)).toEqual(["\"User\""]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["String", "bool", "i32"]);
    expect(sorted_texts(return_bindings)).toEqual([]);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(sorted_texts(value_bindings)).toEqual(["&str", "i32"]);
    expect(sorted_texts(return_bindings)).toEqual(["()"]);
  });

  it("binds struct field annotations as values keyed by each field", () => {
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const user = Array.from(index.classes.values())[0];
    const field_id = (name: string): SymbolId =>
      user.properties.find((field) => field.name === name)!.symbol_id;
    expect(value_bindings).toEqual(
      new Map<SymbolId, string>([
        [field_id("name"), "String"],
        [field_id("age"), "i32"],
        [field_id("is_active"), "bool"],
      ])
    );
    expect(return_bindings.size).toBe(0);
  });

  it("keys an enum method's return annotation apart from its parameter annotations", () => {
    const code = `
      enum Shape { Circle }
      struct Area {}
      impl Shape {
          fn area(&self, scale: f64) -> Area { Area {} }
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const area = Array.from(index.enums.values())[0].methods!.find(
      (method) => method.name === "area"
    )!;
    const [receiver, scale] = area.parameters;
    expect(return_bindings).toEqual(new Map([[area.symbol_id, "Area"]]));
    // The indexer types a `&self` receiver parameter as the impl's own type.
    expect(value_bindings).toEqual(
      new Map<SymbolId, string>([
        [receiver.symbol_id, "Shape"],
        [scale.symbol_id, "f64"],
      ])
    );
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
  });
});

describe("Type Bindings - Edge Cases", () => {
  it("returns an empty map for empty definitions", () => {
    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: new Map(),
      functions: new Map(),
      classes: new Map(),
      interfaces: new Map(),
      enums: new Map(),
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
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

    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(value_bindings.size).toBe(0);
    expect(return_bindings.size).toBe(0);
  });
});
