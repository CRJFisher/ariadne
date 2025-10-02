/**
 * Minimal Type Context Tests
 *
 * Basic smoke tests to verify core functionality works.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { build_type_context } from "./type_context";
import { build_scope_resolver_index } from "../scope_resolver_index/scope_resolver_index";
import { create_resolution_cache } from "../resolution_cache/resolution_cache";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type { FilePath, Language } from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { ParsedFile } from "../../index_single_file/file_utils";

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

describe("Type Context - Minimal Tests", () => {
  let js_parser: Parser;

  beforeAll(() => {
    js_parser = new Parser();
    js_parser.setLanguage(JavaScript);
  });

  it("should build type context without errors", () => {
    const code = `
class MyClass {
  doSomething() { return 42; }
}
const instance = new MyClass();
    `;
    const tree = js_parser.parse(code);
    const file_path = "test.js" as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_semantic_index(parsed_file, tree, "javascript");

    const indices = new Map([[file_path, index]]);
    const resolver_index = build_scope_resolver_index(indices);
    const cache = create_resolution_cache();
    const type_context = build_type_context(indices, resolver_index, cache);

    expect(type_context).toBeDefined();
    expect(typeof type_context.get_symbol_type).toBe("function");
    expect(typeof type_context.get_type_member).toBe("function");
    expect(typeof type_context.get_type_members).toBe("function");
  });

  it("should track constructor assignment in JavaScript", () => {
    const code = `
class Helper {
  help() { return true; }
}
const h = new Helper();
    `;
    const tree = js_parser.parse(code);
    const file_path = "test.js" as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_semantic_index(parsed_file, tree, "javascript");

    // Debug: Check what's in type_bindings
    console.log("Type bindings:", Array.from(index.type_bindings.entries()));
    console.log("References:", index.references.filter(r => r.call_type === "constructor"));
    console.log("Classes:", Array.from(index.classes.entries()).map(([id, def]) => ({
      id,
      name: def.name,
      scope_id: def.scope_id
    })));

    const indices = new Map([[file_path, index]]);
    const resolver_index = build_scope_resolver_index(indices);
    const cache = create_resolution_cache();

    // Debug: Try resolving Helper directly
    const module_scope = "module:test.js:2:1:6:5";
    console.log("Testing direct resolution of 'Helper' in scope:", module_scope);
    const helper_resolved = resolver_index.resolve(module_scope as any, "Helper" as any, cache);
    console.log("Direct resolution result:", helper_resolved);

    const type_context = build_type_context(indices, resolver_index, cache);

    // Find the 'h' variable
    const h_var = Array.from(index.variables.values()).find((v) => v.name === "h");
    expect(h_var).toBeDefined();
    console.log("h_var:", h_var);

    // Get the type of 'h'
    const h_type = type_context.get_symbol_type(h_var!.symbol_id);
    console.log("h_type:", h_type);

    // Verify it's the Helper class
    const helper_class = Array.from(index.classes.values()).find(
      (c) => c.name === "Helper"
    );
    console.log("helper_class:", helper_class?.symbol_id);

    expect(h_type).toBeDefined();
    expect(h_type).toBe(helper_class!.symbol_id);
  });

  it("should look up class members", () => {
    const code = `
class TestClass {
  myMethod() { return 1; }
  myProp = "test";
}
    `;
    const tree = js_parser.parse(code);
    const file_path = "test.js" as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_semantic_index(parsed_file, tree, "javascript");

    const indices = new Map([[file_path, index]]);
    const resolver_index = build_scope_resolver_index(indices);
    const cache = create_resolution_cache();
    const type_context = build_type_context(indices, resolver_index, cache);

    // Find TestClass
    const test_class = Array.from(index.classes.values()).find(
      (c) => c.name === "TestClass"
    );
    expect(test_class).toBeDefined();

    // Get all members
    const members = type_context.get_type_members(test_class!.symbol_id);
    expect(members.size).toBeGreaterThan(0);
  });

  it("should return null for unknown symbol type", () => {
    const code = `
const x = 42;
    `;
    const tree = js_parser.parse(code);
    const file_path = "test.js" as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_semantic_index(parsed_file, tree, "javascript");

    const indices = new Map([[file_path, index]]);
    const resolver_index = build_scope_resolver_index(indices);
    const cache = create_resolution_cache();
    const type_context = build_type_context(indices, resolver_index, cache);

    // Find the 'x' variable
    const x_var = Array.from(index.variables.values()).find((v) => v.name === "x");
    expect(x_var).toBeDefined();

    // Get the type - should be null (no annotation, no constructor)
    const x_type = type_context.get_symbol_type(x_var!.symbol_id);
    expect(x_type).toBeNull();
  });
});
