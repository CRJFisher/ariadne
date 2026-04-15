/**
 * Comprehensive tests for constructor_tracking extraction
 * Tests extraction of constructor bindings across all 4 languages
 *
 * Verifies that extract_constructor_bindings correctly processes constructor
 * calls with construct_target metadata from index_single_file references.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/parsed_file";
import { extract_constructor_bindings } from "./constructor";

// ============================================================================
// Test Helpers
// ============================================================================

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

// ============================================================================
// JavaScript Tests
// ============================================================================

describe("Constructor Tracking - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("should extract constructor binding for simple assignment", () => {
    const code = `
      class User {}
      const user = new User();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["User"]);
  });

  it("should extract constructor bindings for multiple assignments", () => {
    const code = `
      class Dog {}
      class Cat {}

      const myDog = new Dog();
      const myCat = new Cat();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(2);
    const type_values = Array.from(bindings.direct.values()).sort();
    expect(type_values).toEqual(["Cat", "Dog"]);
  });

  it("should extract constructor binding for property assignment", () => {
    const code = `
      class Service {}
      class App {
        constructor() {
          this.service = new Service();
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

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Service"]);
  });

  it("should not extract standalone constructor calls without assignment", () => {
    const code = `
      class Logger {}
      new Logger(); // Standalone, no assignment
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(0);
  });
});

// ============================================================================
// TypeScript Tests
// ============================================================================

describe("Constructor Tracking - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("should extract constructor binding for typed assignment", () => {
    const code = `
      class User {
        name: string;
      }
      const user: User = new User();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["User"]);
  });

  it("should extract constructor bindings for multiple typed assignments", () => {
    const code = `
      class ApiService {
        fetchData() {}
      }

      class DataStore {
        save() {}
      }

      const api = new ApiService();
      const store = new DataStore();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(2);
    const type_values = Array.from(bindings.direct.values()).sort();
    expect(type_values).toEqual(["ApiService", "DataStore"]);
  });

  it("should extract constructor binding for class field assignment", () => {
    const code = `
      class Database {}

      class Application {
        private db: Database;

        constructor() {
          this.db = new Database();
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

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Database"]);
  });

  it("should handle generic class constructors", () => {
    const code = `
      class Container<T> {
        value: T;
      }
      const container = new Container<string>();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Container"]);
  });

  it("should extract qualified constructor binding for namespace-qualified call", () => {
    const code = `
      import * as models from "./models";
      const user = new models.User("Alice");
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.namespace_qualified.size).toBe(1);
    const chains = Array.from(bindings.namespace_qualified.values());
    expect(chains).toEqual([["models", "User"]]);
    expect(bindings.direct.size).toBe(0);
  });
});

// ============================================================================
// Python Tests
// ============================================================================

describe("Constructor Tracking - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("should extract constructor binding for simple assignment", () => {
    const code = `
class User:
    pass

user = User()
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["User"]);
  });

  it("should extract constructor bindings for multiple assignments", () => {
    const code = `
class Dog:
    pass

class Cat:
    pass

my_dog = Dog()
my_cat = Cat()
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(2);
    const type_values = Array.from(bindings.direct.values()).sort();
    expect(type_values).toEqual(["Cat", "Dog"]);
  });

  it("should extract constructor binding for attribute assignment", () => {
    const code = `
class Service:
    pass

class App:
    def __init__(self):
        self.service = Service()
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Service"]);
  });

  it("should handle constructor with type annotations", () => {
    const code = `
class Database:
    pass

db: Database = Database()
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Database"]);
  });
});

// ============================================================================
// Rust Tests
// ============================================================================

describe("Constructor Tracking - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("should extract constructor binding for struct instantiation", () => {
    const code = `
      struct User {
        name: String,
      }

      let user = User { name: String::from("John") };
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["User"]);
  });

  it("should extract constructor bindings for multiple struct instantiations", () => {
    const code = `
      struct Point {
        x: i32,
        y: i32,
      }

      struct Color {
        r: u8,
        g: u8,
        b: u8,
      }

      let point = Point { x: 10, y: 20 };
      let color = Color { r: 255, g: 0, b: 0 };
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(2);
    const type_values = Array.from(bindings.direct.values()).sort();
    expect(type_values).toEqual(["Color", "Point"]);
  });

  it("should extract constructor binding for struct field assignment", () => {
    const code = `
      struct Database;

      struct App {
        db: Database,
      }

      impl App {
        fn new() -> Self {
          let db = Database;
          App { db }
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

    const bindings = extract_constructor_bindings(index.references);

    // App { db } is a return expression (not in let/assignment) so no construct_target
    expect(bindings.direct.size).toBe(0);
  });

  it("should extract constructor binding for Type::new() associated function", () => {
    const code = `
      struct Database {
        name: String,
      }

      impl Database {
        fn new(name: String) -> Database {
          Database { name }
        }
      }

      fn main() {
        let db = Database::new(String::from("test"));
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

    const bindings = extract_constructor_bindings(index.references);

    expect(bindings.direct.size).toBe(1);
    const type_values = Array.from(bindings.direct.values());
    expect(type_values).toEqual(["Database"]);
  });

  it("should handle tuple struct instantiation", () => {
    const code = `
      struct Point(i32, i32);
      let p = Point(10, 20);
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const bindings = extract_constructor_bindings(index.references);

    // Tuple struct Point(10, 20) is captured as a function_call, not constructor_call
    // (only struct expression syntax produces constructor_call references)
    expect(bindings.direct.size).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Constructor Tracking - Edge Cases", () => {
  it("should handle empty references array", () => {
    const bindings = extract_constructor_bindings([]);

    expect(bindings.direct.size).toBe(0);
  });

  it("should handle references without constructor calls", () => {
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

    const bindings = extract_constructor_bindings(index.references);

    // No constructor calls in code
    expect(bindings.direct.size).toBe(0);
  });

  it("should ignore constructor calls without construct_target", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    const code = `
      class Logger {}
      // Standalone constructor call (no assignment)
      new Logger();
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const bindings = extract_constructor_bindings(index.references);

    // Standalone calls without assignment produce no constructor bindings
    expect(bindings.direct.size).toBe(0);
  });
});
