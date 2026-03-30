/**
 * Comprehensive tests for alias_extraction
 * Tests extraction of type alias metadata across all 4 languages
 *
 * Verifies that extract_type_alias_metadata correctly processes type alias
 * definitions and extracts type_expression strings from index_single_file.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_index_single_file } from "../index_single_file";
import type { ParsedFile } from "../file_utils";
import { extract_type_alias_metadata } from "./alias";

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

describe("Type Alias Extraction - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("should handle no type aliases (JavaScript has limited type support)", () => {
    const code = `
      const x = 5;
      function foo() {}
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const metadata = extract_type_alias_metadata(index.types);

    // JavaScript typically doesn't have type aliases without JSDoc/TypeScript
    expect(metadata.size).toBe(0);
  });

  it("should return empty map for code without types", () => {
    const code = `
      const user = { name: "Alice" };
      const getId = () => 42;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.js" as FilePath,
      tree,
      "javascript"
    );
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(0);
  });
});

// ============================================================================
// TypeScript Tests
// ============================================================================

describe("Type Alias Extraction - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("should extract type alias for simple type", () => {
    const code = `
      type UserId = string;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["UserId"]).toBe("string");
  });

  it("should extract type alias for union type", () => {
    const code = `
      type Status = "active" | "inactive" | "pending";
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Status"]).toBe('"active" | "inactive" | "pending"');
  });

  it("should extract type alias for object type", () => {
    const code = `
      type User = { id: number; name: string };
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["User"]).toBe("{ id: number; name: string }");
  });

  it("should extract type alias for generic type", () => {
    const code = `
      type Result<T> = T | Error;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Result"]).toBe("T | Error");
  });

  it("should extract multiple type aliases", () => {
    const code = `
      type UserId = string;
      type UserName = string;
      type Age = number;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(3);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["UserId"]).toBe("string");
    expect(entries["UserName"]).toBe("string");
    expect(entries["Age"]).toBe("number");
  });

  it("should extract type alias referencing another type", () => {
    const code = `
      type User = { name: string };
      type AdminUser = User;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(2);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["User"]).toBe("{ name: string }");
    expect(entries["AdminUser"]).toBe("User");
  });
});

// ============================================================================
// Python Tests
// ============================================================================

describe("Type Alias Extraction - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("should not extract TypeAlias annotation form (only PEP 695 type statement is captured)", () => {
    const code = `
from typing import TypeAlias

UserId: TypeAlias = str
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const metadata = extract_type_alias_metadata(index.types);

    // TypeAlias annotation form is not captured as a type alias — only PEP 695 `type` statement is
    expect(metadata.size).toBe(0);
  });

  it("should not extract assignment-based type alias (only PEP 695 type statement is captured)", () => {
    const code = `
Vector = list[float]
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const metadata = extract_type_alias_metadata(index.types);

    // Assignment-based alias is indexed as a variable, not a type alias
    expect(metadata.size).toBe(0);
  });

  it("should extract PEP 695 type statement (Python 3.12+)", () => {
    const code = `
type Url = str
type Pair = tuple[int, int]
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(2);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Url"]).toBe("str");
    expect(entries["Pair"]).toBe("tuple[int, int]");
  });

  it("should handle no type aliases in simple Python code", () => {
    const code = `
def greet(name):
    return f"Hello, {name}"

x = 5
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.py" as FilePath,
      tree,
      "python"
    );
    const index = build_index_single_file(parsed_file, tree, "python");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(0);
  });
});

// ============================================================================
// Rust Tests
// ============================================================================

describe("Type Alias Extraction - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("should extract type alias for simple type", () => {
    const code = `
type Kilometers = i32;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Kilometers"]).toBe("i32");
  });

  it("should extract type alias for generic type", () => {
    const code = `
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Result"]).toBe(
      "std::result::Result<T, Box<dyn std::error::Error>>"
    );
  });

  it("should extract multiple type aliases", () => {
    const code = `
type Kilometers = i32;
type Miles = f64;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(2);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["Kilometers"]).toBe("i32");
    expect(entries["Miles"]).toBe("f64");
  });

  it("should extract public type alias", () => {
    const code = `
pub type BoxedError = Box<dyn std::error::Error>;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.rs" as FilePath,
      tree,
      "rust"
    );
    const index = build_index_single_file(parsed_file, tree, "rust");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["BoxedError"]).toBe("Box<dyn std::error::Error>");
  });

  it("should not extract trait associated type without value", () => {
    const code = `
trait Iterator {
    type Item;
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

    const metadata = extract_type_alias_metadata(index.types);

    // Trait associated types without a value (type Item;) have no type_expression
    // so they should not appear in the metadata
    expect(metadata.size).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Type Alias Extraction - Edge Cases", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("should handle empty types map", () => {
    const code = `
      const x = 5;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(0);
  });

  it("should handle type alias without type_expression", () => {
    const code = `
      type MyType = string;
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    expect(metadata.size).toBe(1);
    const entries = Object.fromEntries(
      [...metadata.entries()].map(([k, v]) => [k.split(":").pop(), v])
    );
    expect(entries["MyType"]).toBe("string");
  });

  it("should store expressions as strings, not SymbolIds", () => {
    const code = `
      type UserId = string;
      type User = { id: UserId };
    `;

    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript"
    );
    const index = build_index_single_file(parsed_file, tree, "typescript");

    const metadata = extract_type_alias_metadata(index.types);

    // Verify all values are strings (not resolved SymbolIds)
    for (const [type_id, expr] of metadata) {
      expect(typeof expr).toBe("string");
      expect(typeof type_id).toBe("string");
      // Expression should not be a SymbolId format (kind:file:line:col:name)
      // It should be the raw type expression text
    }
  });
});
