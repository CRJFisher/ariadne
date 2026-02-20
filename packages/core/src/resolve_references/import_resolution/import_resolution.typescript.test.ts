/**
 * Tests for TypeScript module resolution
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file/index_single_file";
import type { ParsedFile } from "../../index_single_file/file_utils";

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
    const index = build_index_single_file(parsed_file, tree, "typescript");

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
