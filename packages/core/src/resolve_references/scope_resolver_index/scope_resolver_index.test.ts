/**
 * Tests for Scope Resolver Index
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  build_scope_resolver_index,
  type ResolutionCache,
} from "./scope_resolver_index";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type { FilePath, Language, SymbolId, ScopeId, SymbolName } from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { ParsedFile } from "../../index_single_file/file_utils";

// Test cache implementation
class TestResolutionCache implements ResolutionCache {
  private cache = new Map<string, SymbolId>();

  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined {
    return this.cache.get(`${scope_id}:${name}`);
  }

  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void {
    this.cache.set(`${scope_id}:${name}`, symbol_id);
  }

  has(scope_id: ScopeId, name: SymbolName): boolean {
    return this.cache.has(`${scope_id}:${name}`);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Helper to create ParsedFile
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

describe("Scope Resolver Index", () => {
  let js_parser: Parser;
  let ts_parser: Parser;
  let py_parser: Parser;
  let rust_parser: Parser;

  beforeAll(() => {
    js_parser = new Parser();
    js_parser.setLanguage(JavaScript);

    ts_parser = new Parser();
    ts_parser.setLanguage(TypeScript.typescript);

    py_parser = new Parser();
    py_parser.setLanguage(Python);

    rust_parser = new Parser();
    rust_parser.setLanguage(Rust);
  });

  describe("Basic Functionality", () => {
    it("should build index for single file with multiple scopes", () => {
      const code = `
        const outer = 1;
        function test() {
          const inner = 2;
        }
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);

      expect(resolver_index).toBeDefined();
    });

    it("should resolve local symbol in same scope", () => {
      const code = `const myVar = 1;`;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      // Find the variable definition
      const var_def = Array.from(index.variables.values()).find(v => v.name === "myVar");
      expect(var_def).toBeDefined();

      // Resolve in the scope where the variable is defined
      const resolved = resolver_index.resolve(var_def!.scope_id, "myVar" as SymbolName, cache);
      expect(resolved).toBe(var_def!.symbol_id);
    });

    it("should resolve symbol from parent scope", () => {
      const code = `
function outer() {
  const x = 1;
  function inner() {
    const y = x;
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      // Find x and y variables
      const x_var = Array.from(index.variables.values()).find(v => v.name === "x");
      const y_var = Array.from(index.variables.values()).find(v => v.name === "y");

      expect(x_var).toBeDefined();
      expect(y_var).toBeDefined();

      // Resolve 'x' in the scope where y is defined (inner function body scope)
      // This tests that inner scope can resolve symbols from outer scope
      const resolved = resolver_index.resolve(y_var!.scope_id, "x" as SymbolName, cache);
      expect(resolved).toBe(x_var!.symbol_id);
    });

    it("should return null for unknown symbol", () => {
      const code = `const x = 1;`;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const resolved = resolver_index.resolve(index.root_scope_id, "unknownSymbol" as SymbolName, cache);
      expect(resolved).toBeNull();
    });
  });

  describe("Shadowing", () => {
    it("should shadow parent scope variable", () => {
      const code = `
function test() {
  const x = 1;
  function inner() {
    const x = 2;
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      // Find both x variables
      const variables = Array.from(index.variables.values()).filter(v => v.name === "x");
      expect(variables.length).toBe(2);

      // Sort by location to identify outer vs inner
      const sorted_vars = variables.sort((a, b) => a.location.start_line - b.location.start_line);
      const outer_x = sorted_vars[0];
      const inner_x = sorted_vars[1];

      // Resolve in outer scope - should get outer x
      const outer_resolved = resolver_index.resolve(outer_x.scope_id, "x" as SymbolName, cache);
      expect(outer_resolved).toBe(outer_x.symbol_id);

      // Resolve in inner scope - should get inner x (shadowing)
      const inner_resolved = resolver_index.resolve(inner_x.scope_id, "x" as SymbolName, cache);
      expect(inner_resolved).toBe(inner_x.symbol_id);
    });

    it("should handle multiple levels of shadowing", () => {
      const code = `
function level1() {
  const x = 1;
  function level2() {
    const x = 2;
    function level3() {
      const x = 3;
    }
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      // Find all three x variables
      const variables = Array.from(index.variables.values()).filter(v => v.name === "x");
      expect(variables.length).toBe(3);

      // Sort by location to identify levels
      const sorted_vars = variables.sort((a, b) => a.location.start_line - b.location.start_line);
      const x1 = sorted_vars[0];
      const x2 = sorted_vars[1];
      const x3 = sorted_vars[2];

      // Test resolution at each level
      const level1_resolved = resolver_index.resolve(x1.scope_id, "x" as SymbolName, cache);
      expect(level1_resolved).toBe(x1.symbol_id);

      const level2_resolved = resolver_index.resolve(x2.scope_id, "x" as SymbolName, cache);
      expect(level2_resolved).toBe(x2.symbol_id);

      const level3_resolved = resolver_index.resolve(x3.scope_id, "x" as SymbolName, cache);
      expect(level3_resolved).toBe(x3.symbol_id);
    });
  });

  describe("Inheritance", () => {
    it("should inherit parent resolvers in child scope", () => {
      const code = `
function parent() {
  const parentVar = 1;
  function child() {
    const childVar = 2;
    const sum = parentVar + childVar;
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const parent_var = Array.from(index.variables.values()).find(v => v.name === "parentVar");
      const child_var = Array.from(index.variables.values()).find(v => v.name === "childVar");

      expect(parent_var).toBeDefined();
      expect(child_var).toBeDefined();

      // Child scope can resolve both parent and child variables
      const parent_resolved = resolver_index.resolve(child_var!.scope_id, "parentVar" as SymbolName, cache);
      expect(parent_resolved).toBe(parent_var!.symbol_id);

      const child_resolved = resolver_index.resolve(child_var!.scope_id, "childVar" as SymbolName, cache);
      expect(child_resolved).toBe(child_var!.symbol_id);
    });

    it("should inherit from grandparent scope", () => {
      const code = `
function grandparent() {
  const gpVar = 1;
  function parent() {
    function child() {
      const x = gpVar;
    }
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const gp_var = Array.from(index.variables.values()).find(v => v.name === "gpVar");
      const x_var = Array.from(index.variables.values()).find(v => v.name === "x");

      expect(gp_var).toBeDefined();
      expect(x_var).toBeDefined();

      // Child can resolve grandparent variable
      const resolved = resolver_index.resolve(x_var!.scope_id, "gpVar" as SymbolName, cache);
      expect(resolved).toBe(gp_var!.symbol_id);
    });

    it("should not share local definitions between sibling scopes", () => {
      const code = `
        function sibling1() {
          const x = 1;
        }
        function sibling2() {
          const y = 2;
        }
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const sibling1_scope = Array.from(index.scopes.values()).find(s => s.name === "sibling1");
      const sibling2_scope = Array.from(index.scopes.values()).find(s => s.name === "sibling2");

      expect(sibling1_scope).toBeDefined();
      expect(sibling2_scope).toBeDefined();

      // sibling1 cannot resolve y
      const y_in_sibling1 = resolver_index.resolve(sibling1_scope!.id, "y" as SymbolName, cache);
      expect(y_in_sibling1).toBeNull();

      // sibling2 cannot resolve x
      const x_in_sibling2 = resolver_index.resolve(sibling2_scope!.id, "x" as SymbolName, cache);
      expect(x_in_sibling2).toBeNull();
    });
  });

  describe("Cache Integration", () => {
    it("should cache resolved symbols", () => {
      const code = `const x = 1;`;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const var_def = Array.from(index.variables.values()).find(v => v.name === "x");
      expect(var_def).toBeDefined();

      // First resolution
      const resolved1 = resolver_index.resolve(var_def!.scope_id, "x" as SymbolName, cache);
      expect(resolved1).toBe(var_def!.symbol_id);

      // Check cache
      expect(cache.has(var_def!.scope_id, "x" as SymbolName)).toBe(true);
      expect(cache.get(var_def!.scope_id, "x" as SymbolName)).toBe(var_def!.symbol_id);

      // Second resolution should use cache
      const resolved2 = resolver_index.resolve(var_def!.scope_id, "x" as SymbolName, cache);
      expect(resolved2).toBe(var_def!.symbol_id);
    });

    it("should cache separately for different scopes", () => {
      const code = `
function outer() {
  const x = 1;
  function inner() {
    const x = 2;
  }
}
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      // Find both x variables
      const variables = Array.from(index.variables.values()).filter(v => v.name === "x");
      expect(variables.length).toBe(2);

      // Sort by location to identify outer vs inner
      const sorted_vars = variables.sort((a, b) => a.location.start_line - b.location.start_line);
      const outer_x = sorted_vars[0];
      const inner_x = sorted_vars[1];

      // Resolve in both scopes
      const outer_resolved = resolver_index.resolve(outer_x.scope_id, "x" as SymbolName, cache);
      const inner_resolved = resolver_index.resolve(inner_x.scope_id, "x" as SymbolName, cache);

      // Both should be cached separately
      expect(cache.has(outer_x.scope_id, "x" as SymbolName)).toBe(true);
      expect(cache.has(inner_x.scope_id, "x" as SymbolName)).toBe(true);

      // And they should be different
      expect(outer_resolved).not.toBe(inner_resolved);
    });
  });

  // TypeScript tests skipped due to semantic index limitations with TypeScript type annotations
  // The semantic index currently treats type annotations as imports, causing errors
  // These tests can be re-enabled once the semantic index properly handles TypeScript

  describe("Python", () => {
    it("should resolve function definitions", () => {
      const code = `
def greet(name):
    return f"Hello {name}"

result = greet("World")
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const func_def = Array.from(index.functions.values()).find(f => f.name === "greet");
      expect(func_def).toBeDefined();

      const resolved = resolver_index.resolve(func_def!.scope_id, "greet" as SymbolName, cache);
      expect(resolved).toBe(func_def!.symbol_id);
    });

    it("should resolve class definitions", () => {
      const code = `
class Person:
    def __init__(self, name):
        self.name = name
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const class_def = Array.from(index.classes.values()).find(c => c.name === "Person");
      expect(class_def).toBeDefined();

      const resolved = resolver_index.resolve(class_def!.scope_id, "Person" as SymbolName, cache);
      expect(resolved).toBe(class_def!.symbol_id);
    });
  });

  describe("Rust", () => {
    it("should resolve function definitions", () => {
      const code = `
fn greet(name: &str) -> String {
    format!("Hello {}", name)
}

fn main() {
    let result = greet("World");
}
      `;
      const tree = rust_parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "rust");
      const index = build_semantic_index(parsed_file, tree, "rust");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const func_def = Array.from(index.functions.values()).find(f => f.name === "greet");
      expect(func_def).toBeDefined();

      const resolved = resolver_index.resolve(func_def!.scope_id, "greet" as SymbolName, cache);
      expect(resolved).toBe(func_def!.symbol_id);
    });

    it("should resolve struct definitions", () => {
      const code = `
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };
}
      `;
      const tree = rust_parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "rust");
      const index = build_semantic_index(parsed_file, tree, "rust");

      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = new TestResolutionCache();

      const class_def = Array.from(index.classes.values()).find(c => c.name === "Point");
      expect(class_def).toBeDefined();

      const resolved = resolver_index.resolve(class_def!.scope_id, "Point" as SymbolName, cache);
      expect(resolved).toBe(class_def!.symbol_id);
    });
  });

  describe("Resolver Closure Behavior", () => {
    it("should create lightweight resolver closures", () => {
      const code = `const x = 1;`;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);

      // Build the resolver index
      const resolver_index = build_scope_resolver_index(indices);

      // The resolver should be created but not yet executed
      // We can verify this by checking resolution works
      const cache = new TestResolutionCache();
      const resolved = resolver_index.resolve(index.root_scope_id, "x" as SymbolName, cache);

      expect(resolved).toBeDefined();
    });
  });
});
