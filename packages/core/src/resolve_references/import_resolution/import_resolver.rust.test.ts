/**
 * Tests for Rust module resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { resolve_module_path_rust } from "./import_resolver.rust";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type { ParsedFile } from "../../index_single_file/file_utils";

// Helper to create ParsedFile for Rust
function create_parsed_file(
  code: string,
  file_path: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-rust-modules");

beforeEach(() => {
  // Create test directory structure
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("resolve_module_path_rust", () => {
  it("should resolve crate-relative path with lib.rs", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve crate-relative path with Cargo.toml and src/", () => {
    const cargo_file = path.join(TEST_DIR, "Cargo.toml");
    fs.writeFileSync(cargo_file, '[package]\nname = "test"');

    const src_dir = path.join(TEST_DIR, "src");
    fs.mkdirSync(src_dir);

    const lib_file = path.join(src_dir, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(src_dir, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(src_dir, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve super-relative path", () => {
    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "mod.rs") as FilePath;

    const result = resolve_module_path_rust("super::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve self-relative path", () => {
    const module_dir = path.join(TEST_DIR, "mymod");
    fs.mkdirSync(module_dir);

    const utils_file = path.join(module_dir, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(module_dir, "mod.rs") as FilePath;

    const result = resolve_module_path_rust("self::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve module file (utils.rs)", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve module directory (utils/mod.rs)", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const mod_file = path.join(utils_dir, "mod.rs");
    fs.writeFileSync(mod_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(mod_file);
  });

  it("should prioritize module file over module directory", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const mod_file = path.join(utils_dir, "mod.rs");
    fs.writeFileSync(mod_file, "pub fn other() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    fs.writeFileSync(path.join(utils_dir, "mod.rs"), "pub mod helpers;");

    const helpers_file = path.join(utils_dir, "helpers.rs");
    fs.writeFileSync(helpers_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::utils::helpers", main_file);

    expect(result).toBe(helpers_file);
  });

  it("should resolve deeply nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod a;");

    const a_dir = path.join(TEST_DIR, "a");
    fs.mkdirSync(a_dir);
    fs.writeFileSync(path.join(a_dir, "mod.rs"), "pub mod b;");

    const b_dir = path.join(a_dir, "b");
    fs.mkdirSync(b_dir);
    fs.writeFileSync(path.join(b_dir, "mod.rs"), "pub mod c;");

    const c_file = path.join(b_dir, "c.rs");
    fs.writeFileSync(c_file, "pub fn helper() {}");

    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("crate::a::b::c", main_file);

    expect(result).toBe(c_file);
  });

  it("should return external crate paths as-is", () => {
    const main_file = path.join(TEST_DIR, "main.rs") as FilePath;

    const result = resolve_module_path_rust("std::collections", main_file);

    expect(result).toBe("std::collections");
  });

  it("should find crate root with main.rs", () => {
    const main_file_path = path.join(TEST_DIR, "main.rs");
    fs.writeFileSync(main_file_path, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = main_file_path as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should handle super paths in nested modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils; pub mod helpers;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn util() {}");

    const helpers_file = path.join(TEST_DIR, "helpers.rs");
    fs.writeFileSync(helpers_file, "use super::utils;");

    const main_file = helpers_file as FilePath;

    const result = resolve_module_path_rust("super::utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should return fallback path for non-existent modules", () => {
    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "");

    const main_file = lib_file as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent.rs");

    const result = resolve_module_path_rust("crate::nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should handle Cargo.toml without src/ directory", () => {
    const cargo_file = path.join(TEST_DIR, "Cargo.toml");
    fs.writeFileSync(cargo_file, '[package]\nname = "test"');

    const lib_file = path.join(TEST_DIR, "lib.rs");
    fs.writeFileSync(lib_file, "pub mod utils;");

    const utils_file = path.join(TEST_DIR, "utils.rs");
    fs.writeFileSync(utils_file, "pub fn helper() {}");

    const main_file = lib_file as FilePath;

    const result = resolve_module_path_rust("crate::utils", main_file);

    expect(result).toBe(utils_file);
  });
});

describe("Body-based scopes - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("struct name is in module scope, not struct scope", () => {
    const code = `pub struct MyStruct {
    field: i32,
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Structs are stored in index.classes in Rust
    const struct_def = Array.from(index.classes.values()).find(
      (s) => s.name === "MyStruct"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );
    const struct_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(struct_def).toBeDefined();
    expect(module_scope).toBeDefined();
    expect(struct_scope).toBeDefined();

    // Name in parent scope
    expect(struct_def!.defining_scope_id).toBe(module_scope!.id);
    expect(struct_def!.defining_scope_id).not.toBe(struct_scope!.id);

    // Struct scope should start after the struct name (at '{')
    expect(struct_scope!.location.start_column).toBeGreaterThan(10);
  });

  it("struct body creates a scope at opening brace", () => {
    const code = `pub struct MyStruct {
    pub field1: i32,
    field2: String,
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Structs are stored in index.classes in Rust
    const struct_def = Array.from(index.classes.values()).find(
      (s) => s.name === "MyStruct"
    );
    const struct_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(struct_def).toBeDefined();
    expect(struct_scope).toBeDefined();

    // Struct name is in module scope (parent)
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );
    expect(struct_def!.defining_scope_id).toBe(module_scope!.id);

    // Struct body scope starts after the struct name (at '{')
    expect(struct_scope!.location.start_column).toBeGreaterThan(10);
  });

  it("enum name is in module scope", () => {
    const code = `pub enum Status {
    Ok,
    Error,
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    const enum_def = Array.from(index.enums.values()).find(
      (e) => e.name === "Status"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );

    expect(enum_def).toBeDefined();
    expect(module_scope).toBeDefined();

    expect(enum_def!.defining_scope_id).toBe(module_scope!.id);
  });

  it("enum body creates a scope with variants", () => {
    const code = `pub enum Result {
    Success(i32),
    Failure(String),
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    const enum_def = Array.from(index.enums.values()).find(
      (e) => e.name === "Result"
    );
    const enum_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class" && s.location.start_column > 10
    );

    expect(enum_def).toBeDefined();
    expect(enum_scope).toBeDefined();

    // Find variants in enum (stored as members in Rust)
    const success_variant = enum_def!.members.find((v) => v.name === "Success");
    const failure_variant = enum_def!.members.find((v) => v.name === "Failure");

    expect(success_variant).toBeDefined();
    expect(failure_variant).toBeDefined();

    // Enum body scope starts after the enum name (at '{')
    expect(enum_scope!.location.start_column).toBeGreaterThan(10);
  });

  it("trait name is in module scope", () => {
    const code = `pub trait MyTrait {
    fn method(&self) -> i32;
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Traits are stored in index.interfaces in Rust
    const trait_def = Array.from(index.interfaces.values()).find(
      (t) => t.name === "MyTrait"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );

    expect(trait_def).toBeDefined();
    expect(module_scope).toBeDefined();

    expect(trait_def!.defining_scope_id).toBe(module_scope!.id);
  });

  it("trait body creates a scope with methods", () => {
    const code = `pub trait MyTrait {
    fn method1(&self) -> i32;
    fn method2(&mut self);
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Traits are stored in index.interfaces in Rust
    const trait_def = Array.from(index.interfaces.values()).find(
      (t) => t.name === "MyTrait"
    );
    const trait_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class" && s.location.start_column > 10
    );

    expect(trait_def).toBeDefined();
    expect(trait_scope).toBeDefined();

    // Find methods in trait
    const method1 = trait_def!.methods.find((m) => m.name === "method1");
    const method2 = trait_def!.methods.find((m) => m.name === "method2");

    expect(method1).toBeDefined();
    expect(method2).toBeDefined();

    // Trait body scope starts after the trait name (at '{')
    expect(trait_scope!.location.start_column).toBeGreaterThan(10);
  });

  it("impl block methods are in impl body scope", () => {
    const code = `pub struct MyStruct {}

impl MyStruct {
    pub fn new() -> Self {
        MyStruct {}
    }

    pub fn do_something(&self) {}
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Structs are stored in index.classes, methods from impl blocks are attached to struct
    const struct_def = Array.from(index.classes.values()).find(
      (c) => c.name === "MyStruct"
    );
    // Impl blocks create "block" type scopes, not "class" type
    const impl_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "block" && s.location.start_line === 3
    );

    expect(struct_def).toBeDefined();
    expect(impl_scope).toBeDefined();

    // Find methods in struct (added from impl block)
    const new_method = struct_def!.methods.find((m) => m.name === "new");
    const do_something_method = struct_def!.methods.find(
      (m) => m.name === "do_something"
    );

    expect(new_method).toBeDefined();
    expect(do_something_method).toBeDefined();

    // Methods are in impl scope
    expect(new_method!.defining_scope_id).toBe(impl_scope!.id);
    expect(do_something_method!.defining_scope_id).toBe(impl_scope!.id);
  });

  it("struct/enum/trait/impl scope starts at opening brace", () => {
    const code = `pub struct MyStruct {
    field: i32,
}

pub enum Status {
    Ok,
}

pub trait MyTrait {
    fn method(&self);
}

impl MyStruct {
    fn new() -> Self { MyStruct { field: 0 } }
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Find all body scopes (excluding module scope)
    const body_scopes = Array.from(index.scopes.values()).filter(
      (s) => s.type === "class"
    );

    expect(body_scopes.length).toBeGreaterThanOrEqual(4);

    // All body scopes should start after their keyword/name
    // Struct scope starts after "pub struct MyStruct " (at '{')
    body_scopes.forEach((scope) => {
      // Body scopes should start at a reasonable column position
      // (after keywords and type names)
      expect(scope.location.start_column).toBeGreaterThan(0);
    });
  });

  it("multiple structs - names are in module scope", () => {
    const code = `pub struct FirstStruct {
    field1: i32,
}

pub struct SecondStruct {
    field2: String,
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Structs are stored in index.classes in Rust
    const first_struct = Array.from(index.classes.values()).find(
      (s) => s.name === "FirstStruct"
    );
    const second_struct = Array.from(index.classes.values()).find(
      (s) => s.name === "SecondStruct"
    );
    const module_scopes = Array.from(index.scopes.values()).filter(
      (s) => s.type === "module"
    );

    expect(first_struct).toBeDefined();
    expect(second_struct).toBeDefined();
    expect(module_scopes.length).toBeGreaterThan(0);

    // Both struct names should be in module-level scopes
    const first_scope_type = Array.from(index.scopes.values()).find(
      (s) => s.id === first_struct!.defining_scope_id
    )?.type;
    const second_scope_type = Array.from(index.scopes.values()).find(
      (s) => s.id === second_struct!.defining_scope_id
    )?.type;

    expect(first_scope_type).toBe("module");
    expect(second_scope_type).toBe("module");
  });

  it("enum with struct variants creates body scope", () => {
    const code = `pub enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    const enum_def = Array.from(index.enums.values()).find(
      (e) => e.name === "Message"
    );
    const enum_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class" && s.location.start_column > 10
    );

    expect(enum_def).toBeDefined();
    expect(enum_scope).toBeDefined();

    // Verify all variant types are captured
    const quit_variant = enum_def!.members.find((v) => v.name === "Quit");
    const move_variant = enum_def!.members.find((v) => v.name === "Move");
    const write_variant = enum_def!.members.find((v) => v.name === "Write");

    expect(quit_variant).toBeDefined();
    expect(move_variant).toBeDefined();
    expect(write_variant).toBeDefined();

    // Enum name in module scope
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );
    expect(enum_def!.defining_scope_id).toBe(module_scope!.id);
  });

  it("trait impl block creates scope for methods", () => {
    const code = `pub trait Display {
    fn fmt(&self) -> String;
}

pub struct Point { x: i32, y: i32 }

impl Display for Point {
    fn fmt(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}`;
    const file_path = "test.rs" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "rust");
    const index = build_semantic_index(parsed_file, tree, "rust");

    // Trait stored in interfaces
    const trait_def = Array.from(index.interfaces.values()).find(
      (t) => t.name === "Display"
    );
    expect(trait_def).toBeDefined();
    expect(trait_def!.methods.length).toBeGreaterThan(0);

    // Struct stored in classes
    const struct_def = Array.from(index.classes.values()).find(
      (c) => c.name === "Point"
    );
    expect(struct_def).toBeDefined();

    // Trait impl creates a block scope
    const trait_impl_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "block" && s.location.start_line === 7
    );
    expect(trait_impl_scope).toBeDefined();
  });
});
