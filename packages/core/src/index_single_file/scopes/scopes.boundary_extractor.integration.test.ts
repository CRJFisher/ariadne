/**
 * Integration tests for scope boundary extractors across all languages.
 *
 * This test suite verifies that scope depth calculations are consistent
 * across languages for equivalent constructs.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Rust from "tree-sitter-rust";
import { build_index_single_file } from "../index_single_file";
import type {
  Language,
  FilePath,
  LexicalScope,
  ScopeId,
} from "@ariadnejs/types";
import type { ParsedFile } from "../index_single_file.file_utils";

describe("Scope Boundary Extractor - All Languages", () => {
  let python_parser: Parser;
  let typescript_parser: Parser;
  let javascript_parser: Parser;
  let rust_parser: Parser;

  beforeAll(() => {
    python_parser = new Parser();
    python_parser.setLanguage(Python);

    typescript_parser = new Parser();
    typescript_parser.setLanguage(TypeScript.typescript);

    javascript_parser = new Parser();
    javascript_parser.setLanguage(JavaScript);

    rust_parser = new Parser();
    rust_parser.setLanguage(Rust);
  });

  // Helper to create ParsedFile
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

  function get_parser(language: Language): Parser {
    switch (language) {
    case "python":
      return python_parser;
    case "typescript":
      return typescript_parser;
    case "javascript":
      return javascript_parser;
    case "rust":
      return rust_parser;
    default:
      throw new Error(`Unsupported language: ${language}`);
    }
  }

  function build_index(code: string, language: Language) {
    const parser = get_parser(language);
    const tree = parser.parse(code);
    const file_path = `test.${get_extension(language)}` as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, language);
    return build_index_single_file(parsed_file, tree, language);
  }

  const test_cases = [
    {
      language: "python" as const,
      code: `class Foo:
    def bar(self):
        pass`,
      expected_depths: { class: 1, method: 2 },
    },
    {
      language: "typescript" as const,
      code: `class Foo {
  bar() {
    // method body
  }
}`,
      expected_depths: { class: 1, method: 2 },
    },
    {
      language: "javascript" as const,
      code: `class Foo {
  bar() {
    // method body
  }
}`,
      expected_depths: { class: 1, method: 2 },
    },
    {
      language: "rust" as const,
      code: `struct Foo {
    field: i32,
}

impl Foo {
    fn bar(&self) {
        // method body
    }
}`,
      expected_depths: { class: 1, method: 2 },
    },
  ];

  test_cases.forEach(({ language, code, expected_depths }) => {
    it(`should extract correct depths for ${language}`, () => {
      const index = build_index(code, language);
      const depths = compute_scope_depths(index.scopes);

      const class_scope = find_scope_by_type(index.scopes, "class");
      const method_scope =
        find_scope_by_type(index.scopes, "method") ||
        find_scope_by_type(index.scopes, "function");

      expect(class_scope).toBeDefined();
      expect(method_scope).toBeDefined();
      expect(depths.get(class_scope!.id)).toBe(expected_depths.class);
      expect(depths.get(method_scope!.id)).toBe(expected_depths.method);
    });
  });

  // Test function scopes across languages
  const function_test_cases = [
    {
      language: "python" as const,
      code: `def outer():
    def inner():
        pass`,
      expected_depths: { outer: 1, inner: 2 },
    },
    {
      language: "typescript" as const,
      code: `function outer() {
  function inner() {
    // inner body
  }
}`,
      expected_depths: { outer: 1, inner: 2 },
    },
    {
      language: "javascript" as const,
      code: `function outer() {
  function inner() {
    // inner body
  }
}`,
      expected_depths: { outer: 1, inner: 2 },
    },
    {
      language: "rust" as const,
      code: `fn outer() {
    fn inner() {
        // inner body
    }
}`,
      expected_depths: { outer: 1, inner: 2 },
    },
  ];

  function_test_cases.forEach(({ language, code, expected_depths }) => {
    it(`should extract correct function depths for ${language}`, () => {
      const index = build_index(code, language);
      const depths = compute_scope_depths(index.scopes);

      const function_scopes = Array.from(index.scopes.values()).filter(
        (scope) => scope.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      // Find outer and inner by depth
      const outer_scope = function_scopes.find(
        (scope) => depths.get(scope.id) === expected_depths.outer
      );
      const inner_scope = function_scopes.find(
        (scope) => depths.get(scope.id) === expected_depths.inner
      );

      expect(outer_scope).toBeDefined();
      expect(inner_scope).toBeDefined();
      expect(depths.get(outer_scope!.id)).toBe(expected_depths.outer);
      expect(depths.get(inner_scope!.id)).toBe(expected_depths.inner);
    });
  });

  // Test that all extractors are registered
  it("should have extractors for all supported languages", () => {
    const languages = ["python", "typescript", "javascript", "rust"] as const;

    languages.forEach((language) => {
      const simple_code = get_simple_class_code(language);

      // This should not throw
      expect(() => {
        build_index(simple_code, language);
      }).not.toThrow();
    });
  });

  // Test error handling for malformed constructs
  it("should handle missing body fields gracefully", () => {
    // Test each language with minimal valid code
    const minimal_cases = [
      { language: "python" as const, code: "pass" },
      { language: "typescript" as const, code: "let x = 1;" },
      { language: "javascript" as const, code: "let x = 1;" },
      { language: "rust" as const, code: "fn main() {}" },
    ];

    minimal_cases.forEach(({ language, code }) => {
      expect(() => {
        build_index(code, language);
      }).not.toThrow();
    });
  });
});

/**
 * Helper functions
 */

function compute_scope_depths(
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): Map<ScopeId, number> {
  const depths = new Map<ScopeId, number>();

  for (const scope of scopes.values()) {
    depths.set(scope.id, compute_scope_depth(scope, scopes));
  }

  return depths;
}

function compute_scope_depth(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): number {
  let depth = 0;
  let current_id = scope.parent_id;
  const visited = new Set<ScopeId>();

  while (current_id && !visited.has(current_id)) {
    visited.add(current_id);
    const parent = scopes.get(current_id);
    if (parent) {
      depth++;
      current_id = parent.parent_id;
    } else {
      break;
    }
  }
  return depth;
}

function find_scope_by_type(
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  type: string
): LexicalScope | undefined {
  for (const scope of scopes.values()) {
    if (scope.type === type) {
      return scope;
    }
  }
  return undefined;
}

function get_extension(
  language: "python" | "typescript" | "javascript" | "rust"
): string {
  switch (language) {
  case "python":
    return "py";
  case "typescript":
    return "ts";
  case "javascript":
    return "js";
  case "rust":
    return "rs";
  }
}

function get_simple_class_code(
  language: "python" | "typescript" | "javascript" | "rust"
): string {
  switch (language) {
  case "python":
    return "class Test:\n    pass";
  case "typescript":
  case "javascript":
    return "class Test {}";
  case "rust":
    return "struct Test {}";
  }
}
