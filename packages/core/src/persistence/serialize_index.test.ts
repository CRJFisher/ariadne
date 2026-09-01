import { describe, it, expect } from "vitest";
import type { FilePath, Language, ScopeId, SymbolId } from "@ariadnejs/types";
import type { SemanticIndex } from "@ariadnejs/types";
import {
  to_serializable_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "./serialize_index";
import { build_index_single_file } from "../index_single_file/index_single_file";
import Parser from "tree-sitter";
import { LANGUAGE_TO_TREESITTER_LANG } from "../index_single_file/query_code_tree/parsers";
import PythonParser from "tree-sitter-python";
import JavaScriptParser from "tree-sitter-javascript";
import RustParser from "tree-sitter-rust";
import type { ParsedFile } from "../index_single_file/parsed_file";

/**
 * A `SemanticIndex` as one JSON document. Cache blobs embed the index in their
 * validity stamp rather than stringifying it alone, so this shape exists only
 * for the round-trip guards below and in the sibling persistence tests.
 */
export function serialize_semantic_index(index: SemanticIndex): string {
  return JSON.stringify(to_serializable_semantic_index(index));
}

function make_parsed_file(
  content: string,
  file_path: string,
  tree: Parser.Tree,
  language: Language,
): ParsedFile {
  const lines = content.split("\n");
  return {
    file_path: file_path as FilePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
    source: content,
  };
}

function parse_ts(content: string, file_path = "test.ts"): SemanticIndex {
  const parser = new Parser();
  parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);
  const tree = parser.parse(content);
  const parsed = make_parsed_file(
    content,
    file_path,
    tree,
    "typescript" as Language,
  );
  return build_index_single_file(parsed, tree, "typescript" as Language);
}

function parse_py(content: string, file_path = "test.py"): SemanticIndex {
  const parser = new Parser();
  parser.setLanguage(PythonParser);
  const tree = parser.parse(content);
  const parsed = make_parsed_file(
    content,
    file_path,
    tree,
    "python" as Language,
  );
  return build_index_single_file(parsed, tree, "python" as Language);
}

function parse_js(content: string, file_path = "test.js"): SemanticIndex {
  const parser = new Parser();
  parser.setLanguage(JavaScriptParser);
  const tree = parser.parse(content);
  const parsed = make_parsed_file(
    content,
    file_path,
    tree,
    "javascript" as Language,
  );
  return build_index_single_file(parsed, tree, "javascript" as Language);
}

function parse_rs(content: string, file_path = "test.rs"): SemanticIndex {
  const parser = new Parser();
  parser.setLanguage(RustParser);
  const tree = parser.parse(content);
  const parsed = make_parsed_file(
    content,
    file_path,
    tree,
    "rust" as Language,
  );
  return build_index_single_file(parsed, tree, "rust" as Language);
}

function assert_index_equal(a: SemanticIndex, b: SemanticIndex): void {
  expect(b.file_path).toEqual(a.file_path);
  expect(b.language).toEqual(a.language);
  expect(b.root_scope_id).toEqual(a.root_scope_id);
  expect(b.scopes.size).toEqual(a.scopes.size);
  for (const [key, val] of a.scopes) {
    expect(b.scopes.get(key)).toEqual(val);
  }
  expect(b.functions.size).toEqual(a.functions.size);
  for (const [key, val] of a.functions) {
    expect(b.functions.get(key)).toEqual(val);
  }
  expect(b.classes.size).toEqual(a.classes.size);
  for (const [key, val] of a.classes) {
    expect(b.classes.get(key)).toEqual(val);
  }
  expect(b.variables.size).toEqual(a.variables.size);
  for (const [key, val] of a.variables) {
    expect(b.variables.get(key)).toEqual(val);
  }
  expect(b.interfaces.size).toEqual(a.interfaces.size);
  for (const [key, val] of a.interfaces) {
    expect(b.interfaces.get(key)).toEqual(val);
  }
  expect(b.enums.size).toEqual(a.enums.size);
  for (const [key, val] of a.enums) {
    expect(b.enums.get(key)).toEqual(val);
  }
  expect(b.namespaces.size).toEqual(a.namespaces.size);
  for (const [key, val] of a.namespaces) {
    expect(b.namespaces.get(key)).toEqual(val);
  }
  expect(b.types.size).toEqual(a.types.size);
  for (const [key, val] of a.types) {
    expect(b.types.get(key)).toEqual(val);
  }
  expect(b.imported_symbols.size).toEqual(a.imported_symbols.size);
  for (const [key, val] of a.imported_symbols) {
    expect(b.imported_symbols.get(key)).toEqual(val);
  }
  expect([...b.references]).toEqual([...a.references]);
}

describe("serialize_semantic_index / deserialize_semantic_index", () => {
  describe("minimal round-trips", () => {
    it("round-trips a minimal empty-ish index", () => {
      const index: SemanticIndex = {
        file_path: "test.ts" as FilePath,
        language: "typescript" as Language,
        root_scope_id: "scope:test.ts:0:0:0:0:module" as ScopeId,
        scopes: new Map(),
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };
      const json = serialize_semantic_index(index);
      const restored = deserialize_semantic_index(json);
      assert_index_equal(index, restored);
    });
  });

  describe("pre-parsed object input", () => {
    it("deserializes from an already-parsed object without re-parsing JSON", () => {
      const index = parse_ts(
        "export function greet(name: string): string { return name; }",
      );
      const json = serialize_semantic_index(index);
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const restored = deserialize_semantic_index(parsed);
      assert_index_equal(index, restored);
    });

    it("produces equal indexes from string and object inputs", () => {
      const index = parse_ts("export const x = 1;");
      const json = serialize_semantic_index(index);
      const from_string = deserialize_semantic_index(json);
      const from_object = deserialize_semantic_index(
        JSON.parse(json) as Record<string, unknown>,
      );
      assert_index_equal(from_string, from_object);
    });
  });

  describe("malformed string input", () => {
    it("throws on non-JSON input", () => {
      expect(() => deserialize_semantic_index("not json {")).toThrow();
    });
  });

  /**
   * String identity is not observable from JavaScript, so what a test can hold
   * is that sharing repeated strings changes no VALUE — the retained-bytes half
   * is a measurement and lives in `RECORDED_WORKER_INDEX_DISPATCH`.
   */
  describe("a document whose strings repeat", () => {
    it("restores every repeated string to its own value", () => {
      const index = parse_ts(
        [
          "export class Repeated {",
          "  first(): void {}",
          "  second(): void { this.first(); }",
          "}",
          "export function repeated(): void { new Repeated().second(); }",
        ].join("\n"),
      );
      const restored = deserialize_semantic_index(
        serialize_semantic_index(index),
      );

      assert_index_equal(index, restored);
      expect([...restored.classes.keys()]).toEqual([...index.classes.keys()]);
      expect(restored.references.map((reference) => reference.name)).toEqual(
        index.references.map((reference) => reference.name),
      );
    });
  });

  describe("round-trip with real parsed files", () => {
    it("TypeScript: functions, classes, interfaces", () => {
      const code = `
export function greet(name: string): string { return "Hello " + name; }

export class Animal {
  name: string;
  constructor(name: string) { this.name = name; }
  speak(): string { return this.name + " speaks"; }
}

export interface Printable {
  print(): void;
}

export type ID = string | number;

export enum Color { Red, Green, Blue }

const x = greet("world");
const a = new Animal("dog");
`;
      const index = parse_ts(code);
      const json = serialize_semantic_index(index);
      const restored = deserialize_semantic_index(json);
      assert_index_equal(index, restored);
    });

    it("Python: functions, classes, imports", () => {
      const code = `
def greet(name):
    return "Hello " + name

class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        return self.name + " speaks"

x = greet("world")
`;
      const index = parse_py(code);
      const json = serialize_semantic_index(index);
      const restored = deserialize_semantic_index(json);
      assert_index_equal(index, restored);
    });

    it("JavaScript: functions and classes", () => {
      const code = `
function greet(name) { return "Hello " + name; }

class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + " speaks"; }
}

const x = greet("world");
`;
      const index = parse_js(code);
      const json = serialize_semantic_index(index);
      const restored = deserialize_semantic_index(json);
      assert_index_equal(index, restored);
    });

    it("Rust: functions and structs", () => {
      const code = `
fn greet(name: &str) -> String {
    format!("Hello {}", name)
}

struct Animal {
    name: String,
}

impl Animal {
    fn new(name: String) -> Animal {
        Animal { name }
    }
    fn speak(&self) -> String {
        format!("{} speaks", self.name)
    }
}
`;
      const index = parse_rs(code);
      const json = serialize_semantic_index(index);
      const restored = deserialize_semantic_index(json);
      assert_index_equal(index, restored);
    });
  });

  describe("a receiver chain rooted at an Object.prototype member name", () => {
    // A field holding a function fails the two transports differently: JSON
    // drops it without a word, so a restored file carries a different reference
    // record from a cold one, and structuredClone refuses outright, so the file
    // never crosses a worker boundary at all.
    const OBJECT_PROTOTYPE_MEMBERS = [
      "toString",
      "valueOf",
      "constructor",
      "hasOwnProperty",
    ];

    it.each(OBJECT_PROTOTYPE_MEMBERS)(
      "restores identical reference records for a chain rooted at '%s'",
      (member) => {
        const index = parse_js(`${member}.padStart(2);`);
        const restored = deserialize_semantic_index(
          serialize_semantic_index(index),
        );
        expect([...restored.references]).toEqual([...index.references]);
      },
    );

    it.each(OBJECT_PROTOTYPE_MEMBERS)(
      "clones every reference record for a chain rooted at '%s'",
      (member) => {
        const index = parse_js(`${member}.padStart(2);`);
        expect([...globalThis.structuredClone(index).references]).toEqual([
          ...index.references,
        ]);
      },
    );
  });
});

describe("validate_semantic_index_shape", () => {
  it("returns true for a valid shape", () => {
    const valid = {
      file_path: "test.ts",
      language: "typescript",
      root_scope_id: "scope:0",
      scopes: [],
      functions: [],
      classes: [],
      variables: [],
      interfaces: [],
      enums: [],
      namespaces: [],
      types: [],
      imported_symbols: [],
      references: [],
    };
    expect(validate_semantic_index_shape(valid)).toBe(true);
  });

  it("returns false for null", () => {
    expect(validate_semantic_index_shape(null)).toBe(false);
  });

  it("returns false for non-object primitives", () => {
    expect(validate_semantic_index_shape("scope:0")).toBe(false);
    expect(validate_semantic_index_shape(42)).toBe(false);
    expect(validate_semantic_index_shape(undefined)).toBe(false);
  });

  it("returns false for non-string language", () => {
    expect(
      validate_semantic_index_shape({
        file_path: "test.ts",
        language: 123,
        root_scope_id: "scope:0",
        scopes: [],
        functions: [],
        classes: [],
        variables: [],
        interfaces: [],
        enums: [],
        namespaces: [],
        types: [],
        imported_symbols: [],
        references: [],
      }),
    ).toBe(false);
  });

  it("returns false for non-string root_scope_id", () => {
    expect(
      validate_semantic_index_shape({
        file_path: "test.ts",
        language: "typescript",
        root_scope_id: null,
        scopes: [],
        functions: [],
        classes: [],
        variables: [],
        interfaces: [],
        enums: [],
        namespaces: [],
        types: [],
        imported_symbols: [],
        references: [],
      }),
    ).toBe(false);
  });

  it("returns false for non-array references", () => {
    expect(
      validate_semantic_index_shape({
        file_path: "test.ts",
        language: "typescript",
        root_scope_id: "scope:0",
        scopes: [],
        functions: [],
        classes: [],
        variables: [],
        interfaces: [],
        enums: [],
        namespaces: [],
        types: [],
        imported_symbols: [],
        references: "not an array",
      }),
    ).toBe(false);
  });

  it("returns false for missing fields", () => {
    expect(validate_semantic_index_shape({ file_path: "test.ts" })).toBe(
      false,
    );
  });

  it("returns false for non-array map fields", () => {
    const invalid = {
      file_path: "test.ts",
      language: "typescript",
      root_scope_id: "scope:0",
      scopes: "not an array",
      functions: [],
      classes: [],
      variables: [],
      interfaces: [],
      enums: [],
      namespaces: [],
      types: [],
      imported_symbols: [],
      references: [],
    };
    expect(validate_semantic_index_shape(invalid)).toBe(false);
  });
});
