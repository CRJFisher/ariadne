/**
 * Tests for JavaScript module resolution
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as path from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { resolve_module_path_javascript } from "./import_resolution.javascript";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/index_single_file.file_utils";
import { build_file_tree } from "../resolve_references.file_folders_test_helper";

// Temporary test directory
const TEST_DIR = path.join(process.cwd(), ".test-js-modules");

// Helper to create ParsedFile for JavaScript
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

describe("resolve_module_path_javascript", () => {
  it("should resolve relative import with explicit .js extension", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils.js",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import without extension (tries .js)", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve .mjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.mjs");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve .cjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.cjs");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve index.js in directories", () => {
    const index_file = path.join(TEST_DIR, "utils", "index.js");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([index_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(index_file);
  });

  it("should resolve index.mjs in directories", () => {
    const index_file = path.join(TEST_DIR, "utils", "index.mjs");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([index_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(index_file);
  });

  it("should resolve parent directory imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    const main_file = path.join(TEST_DIR, "sub", "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "../utils.js",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should resolve nested relative imports", () => {
    const utils_file = path.join(TEST_DIR, "helpers", "utils.js");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./helpers/utils.js",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_file);
  });

  it("should return resolved path with extension for non-existent files", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([main_file]);
    const expected = path.join(TEST_DIR, "nonexistent.js"); // Adds .js extension

    const result = resolve_module_path_javascript(
      "./nonexistent",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });

  it("should prioritize exact match over extensions", () => {
    // Create a file named 'utils' (no extension)
    const utils_no_ext = path.join(TEST_DIR, "utils");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([utils_no_ext as FilePath, main_file]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_no_ext);
  });

  it("should return bare imports as-is (node_modules not implemented)", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_javascript(
      "lodash",
      main_file,
      root_folder
    );

    expect(result).toBe("lodash");
  });

  it("should prioritize .js over .mjs and .cjs", () => {
    const utils_js = path.join(TEST_DIR, "utils.js");
    const utils_mjs = path.join(TEST_DIR, "utils.mjs");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([
      utils_js as FilePath,
      utils_mjs as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_javascript(
      "./utils",
      main_file,
      root_folder
    );

    expect(result).toBe(utils_js);
  });

  it("should append .js to paths with invalid extensions (e.g., import_resolution.rust)", () => {
    // Bug fix: import paths like './import_resolution.rust' should resolve to './import_resolution.rust.js'
    // Previously, the code only checked if ANY extension existed, not if it was VALID
    const resolver_file = path.join(TEST_DIR, "import_resolution.rust.js");
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([
      resolver_file as FilePath,
      main_file,
    ]);

    const result = resolve_module_path_javascript(
      "./import_resolution.rust",
      main_file,
      root_folder
    );

    expect(result).toBe(resolver_file);
  });

  it("should append .js when file not found and has invalid extension", () => {
    // Even if file doesn't exist in tree, should infer .js extension for invalid extensions
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const root_folder = build_file_tree([main_file]);
    const expected = path.join(TEST_DIR, "utils.custom.js"); // Should add .js

    const result = resolve_module_path_javascript(
      "./utils.custom",
      main_file,
      root_folder
    );

    expect(result).toBe(expected);
  });
});

describe("Body-based scopes - JavaScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  it("class name is in module scope, not class scope", () => {
    const code = `export class MyClass {
  method() {}
}`;
    const file_path = "test.js" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const class_def = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );
    const class_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(class_def).toBeDefined();
    expect(module_scope).toBeDefined();
    expect(class_scope).toBeDefined();

    // Name in parent scope
    expect(class_def!.defining_scope_id).toBe(module_scope!.id);
    expect(class_def!.defining_scope_id).not.toBe(class_scope!.id);

    // Class scope should start after the class name (at '{')
    expect(class_scope!.location.start_column).toBeGreaterThan(10);
  });

  it("class members are in class body scope", () => {
    const code = `export class MyClass {
  myMethod() {}
}`;
    const file_path = "test.js" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const class_def = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    const class_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(class_def).toBeDefined();
    expect(class_scope).toBeDefined();

    // Find methods in class
    const method_def = class_def!.methods.find((m) => m.name === "myMethod");

    expect(method_def).toBeDefined();

    // Members are in class scope
    expect(method_def!.defining_scope_id).toBe(class_scope!.id);
  });

  it("multiple classes - names are in module scope", () => {
    const code = `export class FirstClass {
  method() {}
}
export class SecondClass {
  anotherMethod() {}
}`;
    const file_path = "test.js" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const first_class = Array.from(index.classes.values()).find(
      (c) => c.name === "FirstClass"
    );
    const second_class = Array.from(index.classes.values()).find(
      (c) => c.name === "SecondClass"
    );
    const module_scopes = Array.from(index.scopes.values()).filter(
      (s) => s.type === "module"
    );

    expect(first_class).toBeDefined();
    expect(second_class).toBeDefined();
    expect(module_scopes.length).toBeGreaterThan(0);

    // Both class names should be in module-level scopes
    const first_scope_type = Array.from(index.scopes.values()).find(
      (s) => s.id === first_class!.defining_scope_id
    )?.type;
    const second_scope_type = Array.from(index.scopes.values()).find(
      (s) => s.id === second_class!.defining_scope_id
    )?.type;

    expect(first_scope_type).toBe("module");
    expect(second_scope_type).toBe("module");
  });

  it("class with multiple members - all in class body scope", () => {
    const code = `export class MyClass {
  method1() {}
  method2() {}
  static staticMethod() {}
}`;
    const file_path = "test.js" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const class_def = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    const class_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(class_def).toBeDefined();
    expect(class_scope).toBeDefined();

    // All methods should be in class scope
    const method1_def = class_def!.methods.find((m) => m.name === "method1");
    const method2_def = class_def!.methods.find((m) => m.name === "method2");
    const static_method_def = class_def!.methods.find(
      (m) => m.name === "staticMethod"
    );

    expect(method1_def).toBeDefined();
    expect(method2_def).toBeDefined();
    expect(static_method_def).toBeDefined();

    expect(method1_def!.defining_scope_id).toBe(class_scope!.id);
    expect(method2_def!.defining_scope_id).toBe(class_scope!.id);
    expect(static_method_def!.defining_scope_id).toBe(class_scope!.id);
  });

  it("class scope starts at opening brace, not at class keyword", () => {
    const code = `export class MyClass {
  method() {}
}`;
    const file_path = "test.js" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
    const index = build_index_single_file(parsed_file, tree, "javascript");

    const class_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(class_scope).toBeDefined();

    // Class scope should start after "export class MyClass " (at '{')
    // The opening brace is after column 0 where "export" starts
    expect(class_scope!.location.start_column).toBeGreaterThan(10);

    // Scope should span to the closing brace
    expect(class_scope!.location.end_line).toBe(3);
  });
});
