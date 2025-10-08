/**
 * Tests for TypeScript module resolution
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as path from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { resolve_module_path_typescript } from "./import_resolver.typescript";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type { ParsedFile } from "../../index_single_file/file_utils";
import { build_file_tree } from "../symbol_resolution.test_helpers";

// Helper to create ParsedFile for TypeScript
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

describe("resolve_module_path_typescript", () => {
  const TEST_DIR = "/test-ts-modules";
  it("should resolve relative import with explicit .ts extension", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils.ts", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should resolve relative import without extension (tries .ts)", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should resolve .tsx files", () => {
    const component_file = path.join(TEST_DIR, "Component.tsx");
    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;
    const root_folder = build_file_tree([component_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./Component", main_file, root_folder);

    expect(result).toBe(component_file);
  });

  it("should resolve .js files in TypeScript projects", () => {
    const utils_file = path.join(TEST_DIR, "utils.js");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should resolve .jsx files in TypeScript projects", () => {
    const component_file = path.join(TEST_DIR, "Component.jsx");
    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;
    const root_folder = build_file_tree([component_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./Component", main_file, root_folder);

    expect(result).toBe(component_file);
  });

  it("should prioritize TypeScript extensions over JavaScript", () => {
    const utils_ts = path.join(TEST_DIR, "utils.ts");
    const utils_js = path.join(TEST_DIR, "utils.js");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_ts as FilePath, utils_js as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(utils_ts);
  });

  it("should resolve index.ts in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    const index_file = path.join(utils_dir, "index.ts");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([index_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(index_file);
  });

  it("should resolve index.tsx in directories", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    const index_file = path.join(utils_dir, "index.tsx");
    const main_file = path.join(TEST_DIR, "main.tsx") as FilePath;
    const root_folder = build_file_tree([index_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(index_file);
  });

  it("should resolve index.js in directories when no .ts/.tsx exists", () => {
    const utils_dir = path.join(TEST_DIR, "utils");
    const index_file = path.join(utils_dir, "index.js");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([index_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(index_file);
  });

  it("should resolve parent directory imports", () => {
    const utils_file = path.join(TEST_DIR, "utils.ts");
    const sub_dir = path.join(TEST_DIR, "sub");
    const main_file = path.join(sub_dir, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("../utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should resolve nested relative imports", () => {
    const helpers_dir = path.join(TEST_DIR, "helpers");
    const utils_file = path.join(helpers_dir, "utils.ts");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_file as FilePath, main_file]);

    const result = resolve_module_path_typescript("./helpers/utils", main_file, root_folder);

    expect(result).toBe(utils_file);
  });

  it("should return resolved path for non-existent files", () => {
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const expected = path.join(TEST_DIR, "nonexistent");
    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_typescript("./nonexistent", main_file, root_folder);

    expect(result).toBe(expected);
  });

  it("should return bare imports as-is (node_modules not implemented)", () => {
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([main_file]);

    const result = resolve_module_path_typescript("react", main_file, root_folder);

    expect(result).toBe("react");
  });

  it("should prioritize exact match over extensions", () => {
    // Create a file named 'utils' (no extension)
    const utils_no_ext = path.join(TEST_DIR, "utils");
    const main_file = path.join(TEST_DIR, "main.ts") as FilePath;
    const root_folder = build_file_tree([utils_no_ext as FilePath, main_file]);

    const result = resolve_module_path_typescript("./utils", main_file, root_folder);

    expect(result).toBe(utils_no_ext);
  });

  it("should handle complex nested paths", () => {
    const deep_dir = path.join(TEST_DIR, "src", "components", "ui");
    const button_file = path.join(deep_dir, "Button.tsx");
    const main_file = path.join(TEST_DIR, "src", "App.tsx") as FilePath;
    const root_folder = build_file_tree([button_file as FilePath, main_file]);

    const result = resolve_module_path_typescript(
      "./components/ui/Button",
      main_file,
      root_folder
    );

    expect(result).toBe(button_file);
  });
});

describe("Body-based scopes - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("class name is in module scope, not class scope", () => {
    const code = `export class MyClass {
  method() {}
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

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

  it("interface name is in module scope", () => {
    const code = `export interface IFoo {
  bar(): void;
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

    const interface_def = Array.from(index.interfaces.values()).find(
      (i) => i.name === "IFoo"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );

    expect(interface_def).toBeDefined();
    expect(module_scope).toBeDefined();

    expect(interface_def!.defining_scope_id).toBe(module_scope!.id);
  });

  it("enum name is in module scope", () => {
    const code = `export enum Status {
  Ok,
  Error
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

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

  it("class members are in class body scope", () => {
    const code = `export class MyClass {
  myMethod() {}
  myProperty: string;
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

    const class_def = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    const class_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class"
    );

    expect(class_def).toBeDefined();
    expect(class_scope).toBeDefined();

    // Find methods and properties in class
    const method_def = class_def!.methods.find((m) => m.name === "myMethod");
    const property_def = class_def!.properties.find(
      (p) => p.name === "myProperty"
    );

    expect(method_def).toBeDefined();
    expect(property_def).toBeDefined();

    // Members are in class scope
    expect(method_def!.defining_scope_id).toBe(class_scope!.id);
    expect(property_def!.defining_scope_id).toBe(class_scope!.id);
  });

  it("interface methods are in interface body scope", () => {
    const code = `export interface IFoo {
  bar(): void;
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

    const interface_def = Array.from(index.interfaces.values()).find(
      (i) => i.name === "IFoo"
    );
    // Interface scopes are stored as "class" type
    // Find scope that starts after "interface IFoo"
    const interface_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class" && s.location.start_column > 10
    );

    expect(interface_def).toBeDefined();
    expect(interface_scope).toBeDefined();

    // Find method in interface
    const method_def = interface_def!.methods.find((m) => m.name === "bar");

    expect(method_def).toBeDefined();

    // Method is in interface scope
    expect(method_def!.defining_scope_id).toBe(interface_scope!.id);
  });

  it("enum body creates a scope", () => {
    const code = `export enum Status {
  Ok,
  Error
}`;
    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
    const index = build_semantic_index(parsed_file, tree, "typescript");

    const enum_def = Array.from(index.enums.values()).find(
      (e) => e.name === "Status"
    );
    const module_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module"
    );
    // Enum scopes are stored as "class" type
    // Find scope that starts after "enum Status"
    const enum_scope = Array.from(index.scopes.values()).find(
      (s) => s.type === "class" && s.location.start_column > 10
    );

    expect(enum_def).toBeDefined();
    expect(module_scope).toBeDefined();
    expect(enum_scope).toBeDefined();

    // Enum name is in module scope
    expect(enum_def!.defining_scope_id).toBe(module_scope!.id);

    // Enum scope should start after the enum name (at '{')
    expect(enum_scope!.location.start_column).toBeGreaterThan(10);
  });
});
