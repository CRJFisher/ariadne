/**
 * Tests for extract_type_alias_metadata: extraction of raw type-alias
 * expression strings from index_single_file output across all four languages.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { Language, FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/parsed_file";
import { extract_type_alias_metadata } from "./alias";

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

/**
 * Projects the SymbolId-keyed result onto its trailing alias name so
 * assertions can name aliases directly instead of full location-bearing
 * SymbolIds, which carry brittle line/column coordinates.
 */
function by_alias_name(
  metadata: ReadonlyMap<SymbolId, SymbolName>
): Record<string, SymbolName> {
  return Object.fromEntries(
    [...metadata.entries()].map(([symbol_id, expr]) => [
      symbol_id.split(":").pop(),
      expr,
    ])
  );
}

function extract_from(
  code: string,
  file_path: FilePath,
  parser: Parser,
  language: Language
): ReadonlyMap<SymbolId, SymbolName> {
  const tree = parser.parse(code);
  const parsed_file = create_parsed_file(code, file_path, tree, language);
  const index = build_index_single_file(parsed_file, tree, language);
  return extract_type_alias_metadata(index.types);
}

describe("Type Alias Extraction - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("extracts nothing from JavaScript, which has no type aliases", () => {
    const code = `
      const x = 5;
      function foo() {}
    `;

    const metadata = extract_from(code, "test.js" as FilePath, parser, "javascript");

    expect(by_alias_name(metadata)).toEqual({});
  });
});

describe("Type Alias Extraction - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("extracts the expression of a simple alias", () => {
    const code = "type UserId = string;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({ UserId: "string" });
  });

  it("extracts a union expression verbatim", () => {
    const code = "type Status = \"active\" | \"inactive\" | \"pending\";";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      Status: "\"active\" | \"inactive\" | \"pending\"",
    });
  });

  it("extracts an object-type expression verbatim", () => {
    const code = "type User = { id: number; name: string };";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      User: "{ id: number; name: string }",
    });
  });

  it("extracts a generic expression without its type parameters", () => {
    const code = "type Result<T> = T | Error;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({ Result: "T | Error" });
  });

  it("extracts every alias in a file, keyed independently", () => {
    const code = `
      type UserId = string;
      type UserName = string;
      type Age = number;
    `;

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      UserId: "string",
      UserName: "string",
      Age: "number",
    });
  });

  it("stores an alias-to-alias reference as the raw target name, unresolved", () => {
    const code = `
      type User = { name: string };
      type AdminUser = User;
    `;

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      User: "{ name: string }",
      AdminUser: "User",
    });
  });

  it("extracts each link of an alias chain as its own verbatim expression", () => {
    const code = `
      type A = string;
      type B = A;
      type C = B;
    `;

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      A: "string",
      B: "A",
      C: "B",
    });
  });

  it("stores an alias to an undefined type as its raw name, without resolution", () => {
    const code = "type Handle = DoesNotExist;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({ Handle: "DoesNotExist" });
  });

  it("stores a self-referential alias as its own name without recursing", () => {
    const code = "type Json = string | number | Json[];";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({
      Json: "string | number | Json[]",
    });
  });

  it("keys the result by full SymbolId, not by alias name", () => {
    const code = "type UserId = string;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    const [symbol_id, expression] = [...metadata.entries()][0];
    expect(symbol_id.endsWith(":UserId")).toBe(true);
    expect(symbol_id.split(":").length).toBeGreaterThan(1);
    expect(expression).toBe("string");
  });

  it("extracts nothing from a file with no type aliases", () => {
    const code = "const x = 5;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({});
  });
});

describe("Type Alias Extraction - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("ignores the TypeAlias annotation form, capturing only PEP 695 statements", () => {
    const code = `
from typing import TypeAlias

UserId: TypeAlias = str
    `;

    const metadata = extract_from(code, "test.py" as FilePath, parser, "python");

    expect(by_alias_name(metadata)).toEqual({});
  });

  it("ignores assignment-based aliases, which index as variables", () => {
    const code = "Vector = list[float]";

    const metadata = extract_from(code, "test.py" as FilePath, parser, "python");

    expect(by_alias_name(metadata)).toEqual({});
  });

  it("extracts PEP 695 type statements", () => {
    const code = `
type Url = str
type Pair = tuple[int, int]
    `;

    const metadata = extract_from(code, "test.py" as FilePath, parser, "python");

    expect(by_alias_name(metadata)).toEqual({
      Url: "str",
      Pair: "tuple[int, int]",
    });
  });

  it("extracts nothing from Python code without type statements", () => {
    const code = `
def greet(name):
    return f"Hello, {name}"

x = 5
    `;

    const metadata = extract_from(code, "test.py" as FilePath, parser, "python");

    expect(by_alias_name(metadata)).toEqual({});
  });
});

describe("Type Alias Extraction - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  it("extracts the expression of a simple alias", () => {
    const code = "type Kilometers = i32;";

    const metadata = extract_from(code, "test.rs" as FilePath, parser, "rust");

    expect(by_alias_name(metadata)).toEqual({ Kilometers: "i32" });
  });

  it("extracts a generic expression without its type parameters", () => {
    const code = "type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;";

    const metadata = extract_from(code, "test.rs" as FilePath, parser, "rust");

    expect(by_alias_name(metadata)).toEqual({
      Result: "std::result::Result<T, Box<dyn std::error::Error>>",
    });
  });

  it("extracts every alias in a file, keyed independently", () => {
    const code = `
type Kilometers = i32;
type Miles = f64;
    `;

    const metadata = extract_from(code, "test.rs" as FilePath, parser, "rust");

    expect(by_alias_name(metadata)).toEqual({
      Kilometers: "i32",
      Miles: "f64",
    });
  });

  it("extracts a public alias the same as a private one", () => {
    const code = "pub type BoxedError = Box<dyn std::error::Error>;";

    const metadata = extract_from(code, "test.rs" as FilePath, parser, "rust");

    expect(by_alias_name(metadata)).toEqual({
      BoxedError: "Box<dyn std::error::Error>",
    });
  });

  it("skips a trait associated type declared without a value", () => {
    const code = `
trait Iterator {
    type Item;
}
    `;

    const metadata = extract_from(code, "test.rs" as FilePath, parser, "rust");

    expect(by_alias_name(metadata)).toEqual({});
  });
});

describe("Type Alias Extraction - Edge Cases", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("extracts nothing from an empty types map", () => {
    const code = "const x = 5;";

    const metadata = extract_from(code, "test.ts" as FilePath, parser, "typescript");

    expect(by_alias_name(metadata)).toEqual({});
  });
});
