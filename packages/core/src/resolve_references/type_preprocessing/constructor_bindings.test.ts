import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { LANGUAGE_TO_TREESITTER_LANG } from "../../index_single_file/query_code_tree/parsers";
import Rust from "tree-sitter-rust";
import { Project } from "../../project/project";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/parsed_file";
import { extract_constructor_bindings } from "./constructor_bindings";

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

describe("Constructor Tracking - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("binds a simple assignment to its class name", () => {
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

    expect(Array.from(bindings.values())).toEqual([["User"]]);
  });

  it("binds each of multiple assignments to its class name", () => {
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

    expect(Array.from(bindings.values()).sort()).toEqual([["Cat"], ["Dog"]]);
  });

  it("binds a constructor assigned to an object property", () => {
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

    expect(Array.from(bindings.values())).toEqual([["Service"]]);
  });

  it("skips a standalone constructor call with no assignment target", () => {
    const code = `
      class Logger {}
      new Logger();
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

    expect(bindings.size).toBe(0);
  });

  it("binds a subclass instantiation to the subclass, not its base class", () => {
    const code = `
      class Animal {}
      class Dog extends Animal {}
      const d = new Dog();
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

    expect(Array.from(bindings.values())).toEqual([["Dog"]]);
  });

  it("binds a constructor whose class is never defined", () => {
    const code = `
      const x = new Unknown();
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

    expect(Array.from(bindings.values())).toEqual([["Unknown"]]);
  });

  it("binds a class that declares an explicit constructor to its name", () => {
    const code = `
      class Widget {
        constructor() {}
      }
      const w = new Widget();
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

    expect(Array.from(bindings.values())).toEqual([["Widget"]]);
  });

  it("skips a constructor returned from a factory without assignment", () => {
    const code = `
      class Thing {}
      function make() {
        return new Thing();
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

    expect(bindings.size).toBe(0);
  });
});

describe("Constructor Tracking - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);
  });

  it("binds a type-annotated assignment to its class name", () => {
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

    expect(Array.from(bindings.values())).toEqual([["User"]]);
  });

  it("binds each of multiple typed assignments to its class name", () => {
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

    expect(Array.from(bindings.values()).sort()).toEqual([["ApiService"], ["DataStore"]]);
  });

  it("binds a constructor assigned to a class field", () => {
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

    expect(Array.from(bindings.values())).toEqual([["Database"]]);
  });

  it("binds a generic class constructor to its base class name", () => {
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

    expect(Array.from(bindings.values())).toEqual([["Container"]]);
  });

  it("binds a namespace-qualified call to its full namespace chain", () => {
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

    expect(Array.from(bindings.values())).toEqual([["models", "User"]]);
  });

  it("keys direct and namespace-qualified calls in one file by their own chains", () => {
    const code = `
      import * as models from "./models";
      const a = new User();
      const u = new models.User("x");
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

    expect(Array.from(bindings.values())).toEqual([["User"], ["models", "User"]]);
  });
});

/**
 * A Python construction is a plain call in the index and becomes a constructor
 * call only once its callee has resolved to a class, so the bindings a Python
 * file yields are read off its references after preprocessing, through a
 * Project, rather than off the raw index.
 */
describe("Constructor Tracking - Python", () => {
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  async function python_bindings(code: string) {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ctor-bindings-")));
    temp_dirs.push(dir);
    const file = path.join(dir, "test.py") as FilePath;
    const project = new Project();
    await project.initialize(dir as FilePath);
    project.update_file(file, code);
    return extract_constructor_bindings(project.references.get_file_references(file));
  }

  it("binds a simple assignment to its class name", async () => {
    const code = `
class User:
    pass

user = User()
    `;

    const bindings = await python_bindings(code);

    expect(Array.from(bindings.values())).toEqual([["User"]]);
  });

  it("binds each of multiple assignments to its class name", async () => {
    const code = `
class Dog:
    pass

class Cat:
    pass

my_dog = Dog()
my_cat = Cat()
    `;

    const bindings = await python_bindings(code);

    expect(Array.from(bindings.values()).sort()).toEqual([["Cat"], ["Dog"]]);
  });

  it("binds a constructor assigned to an instance attribute", async () => {
    const code = `
class Service:
    pass

class App:
    def __init__(self):
        self.service = Service()
    `;

    const bindings = await python_bindings(code);

    expect(Array.from(bindings.values())).toEqual([["Service"]]);
  });

  it("binds a type-annotated assignment to its class name", async () => {
    const code = `
class Database:
    pass

db: Database = Database()
    `;

    const bindings = await python_bindings(code);

    expect(Array.from(bindings.values())).toEqual([["Database"]]);
  });

  it("binds a class that defines __init__ to its class name", async () => {
    const code = `
class X:
    def __init__(self):
        pass

x = X()
    `;

    const bindings = await python_bindings(code);

    expect(Array.from(bindings.values())).toEqual([["X"]]);
  });
});

describe("Constructor Tracking - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("binds a struct expression to its struct name", () => {
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

    expect(Array.from(bindings.values())).toEqual([["User"]]);
  });

  it("binds each of multiple struct expressions to its struct name", () => {
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

    expect(Array.from(bindings.values()).sort()).toEqual([["Color"], ["Point"]]);
  });

  it("skips a struct expression returned without assignment", () => {
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

    // `App { db }` is a return expression, not a let/assignment, so it carries no construct_target.
    expect(bindings.size).toBe(0);
  });

  it("binds a Type::new() associated function call to its type name", () => {
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

    expect(Array.from(bindings.values())).toEqual([["Database"]]);
  });

  it("skips tuple-struct instantiation, which indexes as a function call", () => {
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

    // Only struct-expression syntax (`Point { .. }`) produces a constructor_call
    // reference; `Point(10, 20)` indexes as a function_call.
    expect(bindings.size).toBe(0);
  });
});

describe("Constructor Tracking - Edge Cases", () => {
  it("returns empty maps for an empty references array", () => {
    const bindings = extract_constructor_bindings([]);

    expect(bindings.size).toBe(0);
  });

  it("returns empty maps when no reference is a constructor call", () => {
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

    expect(bindings.size).toBe(0);
  });

  it("skips constructor calls that carry no construct_target", () => {
    const parser = new Parser();
    parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);

    const code = `
      class Logger {}
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

    expect(bindings.size).toBe(0);
  });
});
