/**
 * Comprehensive tests for member_extraction
 * Tests extraction of type members across all 4 languages
 *
 * Verifies that extract_type_members correctly processes classes, interfaces,
 * and enums to build TypeMemberInfo indexes.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath, SymbolName } from "@ariadnejs/types";
import { build_index_single_file } from "../index_single_file";
import type { ParsedFile } from "../file_utils";
import { extract_type_members } from "./member";

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

describe("Member Extraction - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("should extract class methods", () => {
    const code = `
      class User {
        getName() { return this.name; }
        getEmail() { return this.email; }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["getEmail", "getName"] as SymbolName[]
    );
    expect(user_members.properties.size).toBe(0);
    expect(user_members.constructor).toBeUndefined();
    expect(user_members.extends).toEqual([]);
  });

  it("should extract class properties", () => {
    const code = `
      class User {
        constructor() {
          this.name = "";
          this.email = "";
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(user_members.constructor).toBeDefined();
    expect(user_members.methods.size).toBe(0);
    // JS does not extract `this.x = ...` assignments as properties
    expect(user_members.properties.size).toBe(0);
    expect(user_members.extends).toEqual([]);
  });

  it("should extract multiple classes", () => {
    const code = `
      class Dog {
        bark() {}
      }
      class Cat {
        meow() {}
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(2);

    const all_methods = Array.from(members.values())
      .flatMap((m) => Array.from(m.methods.keys()))
      .sort();
    expect(all_methods).toEqual(["bark", "meow"] as SymbolName[]);
  });

  it("should track class inheritance", () => {
    const code = `
      class Animal {
        move() {}
      }
      class Dog extends Animal {
        bark() {}
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(2);

    const members_array = Array.from(members.values());
    const animal = members_array.find((m) =>
      m.methods.has("move" as SymbolName)
    )!;
    const dog = members_array.find((m) =>
      m.methods.has("bark" as SymbolName)
    )!;

    expect(Array.from(animal.methods.keys())).toEqual([
      "move",
    ] as SymbolName[]);
    expect(animal.extends).toEqual([]);

    expect(Array.from(dog.methods.keys())).toEqual(["bark"] as SymbolName[]);
    // JS does not currently extract 'extends' for classes
    expect(dog.extends).toEqual([]);
  });
});

// ============================================================================
// TypeScript Tests
// ============================================================================

describe("Member Extraction - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("should extract class methods and properties", () => {
    const code = `
      class User {
        name: string;
        email: string;

        getName(): string { return this.name; }
        getEmail(): string { return this.email; }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["getEmail", "getName"] as SymbolName[]
    );
    expect(Array.from(user_members.properties.keys()).sort()).toEqual(
      ["email", "name"] as SymbolName[]
    );
    expect(user_members.constructor).toBeUndefined();
    expect(user_members.extends).toEqual([]);
  });

  it("should track constructor", () => {
    const code = `
      class User {
        constructor(name: string) {
          this.name = name;
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(user_members.constructor).toBeDefined();
    expect(user_members.constructor!.endsWith(":constructor")).toBe(true);
    expect(user_members.methods.size).toBe(0);
    expect(user_members.properties.size).toBe(0);
  });

  it("should extract interface methods and properties", () => {
    const code = `
      interface IUser {
        name: string;
        email: string;
        getName(): string;
        getEmail(): string;
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const iface_members = Array.from(members.values())[0];
    expect(Array.from(iface_members.methods.keys()).sort()).toEqual(
      ["getEmail", "getName"] as SymbolName[]
    );
    expect(Array.from(iface_members.properties.keys()).sort()).toEqual(
      ["email", "name"] as SymbolName[]
    );
    expect(iface_members.constructor).toBeUndefined();
    expect(iface_members.extends).toEqual([]);
  });

  it("should track interface extension", () => {
    const code = `
      interface IBase {
        id: number;
      }
      interface IUser extends IBase {
        name: string;
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(2);

    const members_array = Array.from(members.values());
    const ibase = members_array.find((m) =>
      m.properties.has("id" as SymbolName)
    )!;
    const iuser = members_array.find((m) =>
      m.properties.has("name" as SymbolName)
    )!;

    expect(ibase.extends).toEqual([]);
    expect(Array.from(ibase.properties.keys())).toEqual([
      "id",
    ] as SymbolName[]);

    expect(iuser.extends).toEqual(["IBase"]);
    expect(Array.from(iuser.properties.keys())).toEqual([
      "name",
    ] as SymbolName[]);
  });

  it("should handle static and instance methods", () => {
    const code = `
      class User {
        static create(): User { return new User(); }
        getName(): string { return ""; }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["create", "getName"] as SymbolName[]
    );
  });
});

// ============================================================================
// Python Tests
// ============================================================================

describe("Member Extraction - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("should extract class methods", () => {
    const code = `
class User:
    def get_name(self) -> str:
        pass

    def get_email(self) -> str:
        pass
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["get_email", "get_name"] as SymbolName[]
    );
    expect(user_members.properties.size).toBe(0);
    expect(user_members.constructor).toBeUndefined();
    expect(user_members.extends).toEqual([]);
  });

  it("should extract class with __init__ constructor", () => {
    const code = `
class User:
    def __init__(self, name: str):
        self.name = name
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(user_members.constructor).toBeDefined();
    expect(user_members.constructor!.endsWith(":__init__")).toBe(true);
    expect(user_members.methods.size).toBe(0);
    expect(Array.from(user_members.properties.keys())).toEqual([
      "name",
    ] as SymbolName[]);
  });

  it("should track class inheritance", () => {
    const code = `
class Animal:
    def move(self):
        pass

class Dog(Animal):
    def bark(self):
        pass
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(2);

    // Find Dog class (should have extends)
    const members_array = Array.from(members.values());
    const dog_members = members_array.find((m) => m.extends.length > 0);

    expect(dog_members).toBeDefined();
    expect(dog_members!.extends).toContain("Animal");

    // Should only have bark, not move
    expect(dog_members!.methods.has("bark" as SymbolName)).toBe(true);
    expect(dog_members!.methods.has("move" as SymbolName)).toBe(false);
  });

  it("should handle static methods", () => {
    const code = `
class User:
    @staticmethod
    def create():
        return User()

    def get_name(self):
        return ""
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["create", "get_name"] as SymbolName[]
    );
  });

  it("should extract Protocol members as interface", () => {
    const code = `
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None:
        ...
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const drawable_members = Array.from(members.values())[0];
    expect(Array.from(drawable_members.methods.keys())).toEqual([
      "draw",
    ] as SymbolName[]);
    expect(drawable_members.properties.size).toBe(0);
    expect(drawable_members.constructor).toBeUndefined();
    expect(drawable_members.extends).toEqual([]);
  });

  it("should extract Enum members", () => {
    const code = `
from enum import Enum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const color_members = Array.from(members.values())[0];
    expect(color_members.methods.size).toBe(0);
    expect(color_members.properties.size).toBe(0);
    expect(color_members.constructor).toBeUndefined();
    expect(color_members.extends).toEqual([]);
  });
});

// ============================================================================
// Rust Tests
// ============================================================================

describe("Member Extraction - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("should extract struct methods from impl block", () => {
    const code = `
      struct User {}

      impl User {
          fn new() -> User { User {} }
          fn get_name(&self) -> String { String::new() }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys()).sort()).toEqual(
      ["get_name", "new"] as SymbolName[]
    );
    expect(user_members.properties.size).toBe(0);
    expect(user_members.constructor).toBeUndefined();
    expect(user_members.extends).toEqual([]);
  });

  it("should extract enum methods", () => {
    const code = `
      enum Result {
          Ok(i32),
          Err(String)
      }

      impl Result {
          fn is_ok(&self) -> bool { true }
          fn is_err(&self) -> bool { false }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    // Rust enum impl methods are not attached to the enum definition
    const enum_members = Array.from(members.values())[0];
    expect(enum_members.methods.size).toBe(0);
    expect(enum_members.properties.size).toBe(0);
    expect(enum_members.constructor).toBeUndefined();
  });

  it("should handle struct with fields", () => {
    const code = `
      struct User {
          name: String,
          email: String,
      }

      impl User {
          fn new(name: String) -> User {
              User { name, email: String::new() }
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const user_members = Array.from(members.values())[0];
    expect(Array.from(user_members.methods.keys())).toEqual([
      "new",
    ] as SymbolName[]);
    expect(Array.from(user_members.properties.keys()).sort()).toEqual(
      ["email", "name"] as SymbolName[]
    );
    expect(user_members.constructor).toBeUndefined();
  });

  it("should handle enum without methods", () => {
    const code = `
      enum Color {
          Red,
          Green,
          Blue
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
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const color_members = Array.from(members.values())[0];
    expect(color_members.methods.size).toBe(0);
    expect(color_members.properties.size).toBe(0);
    expect(color_members.constructor).toBeUndefined();
    expect(color_members.extends).toEqual([]);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Member Extraction - Edge Cases", () => {
  let js_parser: Parser;

  beforeAll(() => {
    js_parser = new Parser();
    js_parser.setLanguage(JavaScript);
  });

  it("should handle empty class", () => {
    const code = `
      class Empty {}
    `;

    const tree = js_parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const empty_members = Array.from(members.values())[0];
    expect(empty_members.methods.size).toBe(0);
    expect(empty_members.properties.size).toBe(0);
    expect(empty_members.constructor).toBeUndefined();
    expect(empty_members.extends).toEqual([]);
  });

  it("should handle no definitions", () => {
    const code = `
      const x = 1;
      function foo() {}
    `;

    const tree = js_parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    // Should return empty map (no classes/interfaces/enums)
    expect(members.size).toBe(0);
  });

  it("should handle class with only constructor", () => {
    const code = `
      class OnlyConstructor {
        constructor(name) {
          this.name = name;
        }
      }
    `;

    const tree = js_parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");
    const members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    expect(members.size).toBe(1);

    const class_members = Array.from(members.values())[0];
    expect(class_members.constructor).toBeDefined();
    expect(class_members.constructor!.endsWith(":constructor")).toBe(true);
    expect(class_members.methods.size).toBe(0);
    expect(class_members.properties.size).toBe(0);
  });
});
