/**
 * Tests for JavaScript module resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { resolve_module_path_javascript } from "./import_resolver.javascript";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type { ParsedFile } from "../../index_single_file/file_utils";

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

describe("resolve_module_path_javascript", () => {
  it("should resolve relative import with explicit .js extension", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils.js", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import without extension (tries .js)", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .mjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.mjs");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve .cjs files", () => {
    const utils_file = path.join(TEST_DIR, "utils.cjs");
    fs.writeFileSync(utils_file, "module.exports = {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve index.js in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.js");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve index.mjs in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    fs.mkdirSync(utils_dir);
    const index_file = path.join(utils_dir, "index.mjs");
    fs.writeFileSync(index_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(index_file);
  });

  it("should resolve parent directory imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const sub_dir = path.join(TEST_DIR, "sub");
    fs.mkdirSync(sub_dir);
    const main_file = path.join(sub_dir, "main.js") as FilePath;

    const result = resolve_module_path_javascript("../utils.js", main_file);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested relative imports", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    fs.mkdirSync(helpers_dir);
    const utils_file = path.join(helpers_dir, "utils.js");
    fs.writeFileSync(utils_file, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript(
      "./helpers/utils.js",
      main_file
    );

    expect(result).toBe(utils_file);
  });

  it("should return resolved path for non-existent files", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent");

    const result = resolve_module_path_javascript("./nonexistent", main_file);

    expect(result).toBe(expected);
  });

  it("should prioritize exact match over extensions", () => {
    // Create a file named 'utils' (no extension)
    const utils_no_ext = path.join(TEST_DIR, "utils");
    fs.writeFileSync(utils_no_ext, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_no_ext);
  });

  it("should return bare imports as-is (node_modules not implemented)", () => {
    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("lodash", main_file);

    expect(result).toBe("lodash");
  });

  it("should prioritize .js over .mjs and .cjs", () => {
    const utils_js = path.join(TEST_DIR, "utils.js");
    const utils_mjs = path.join(TEST_DIR, "utils.mjs");

    fs.writeFileSync(utils_js, "export function helper() {}");
    fs.writeFileSync(utils_mjs, "export function helper() {}");

    const main_file = path.join(TEST_DIR, "main.js") as FilePath;

    const result = resolve_module_path_javascript("./utils", main_file);

    expect(result).toBe(utils_js);
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
    const index = build_semantic_index(parsed_file, tree, "javascript");

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
    const index = build_semantic_index(parsed_file, tree, "javascript");

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
    const index = build_semantic_index(parsed_file, tree, "javascript");

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
    const index = build_semantic_index(parsed_file, tree, "javascript");

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
    const index = build_semantic_index(parsed_file, tree, "javascript");

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
