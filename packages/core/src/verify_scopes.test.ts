/**
 * Manual verification of scope assignment across languages
 */
import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import TypeScriptParser from "tree-sitter-typescript";
import JavaScriptParser from "tree-sitter-javascript";
import PythonParser from "tree-sitter-python";
import RustParser from "tree-sitter-rust";
import { build_semantic_index } from "./index_single_file/semantic_index";
import type { FilePath, Language } from "@ariadnejs/types";

// Helper to create parsed file (matches existing test setup)
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
) {
  const lines = code.split("\n");
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

describe("Scope Assignment Verification", () => {
  it("TypeScript: class, interface, enum in module scope", () => {
    const code = `class MyClass {
  method() {}
}

interface MyInterface {
  prop: string;
}

enum MyEnum {
  A, B, C
}`;

    const parser = new Parser();
    parser.setLanguage(TypeScriptParser.tsx);
    const tree = parser.parse(code);
    const parsedFile = createParsedFile(
      code,
      "test.ts" as FilePath,
      tree,
      "typescript" as Language
    );
    const index = build_semantic_index(
      parsedFile,
      tree,
      "typescript" as Language
    );

    // Find module scope
    const moduleScope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module" && s.parent_id === null
    );
    expect(moduleScope).toBeDefined();

    console.log("\n📋 TypeScript Scope Assignment:");
    console.log(`Module scope: ${moduleScope!.id}`);

    // Debug: show all definitions
    console.log(
      "\nAll classes:",
      Array.from(index.classes.values()).map((c) => ({
        name: c.name,
        scope_id: c.defining_scope_id,
      }))
    );
    console.log(
      "All interfaces:",
      Array.from(index.interfaces.values()).map((i) => ({
        name: i.name,
        scope_id: i.defining_scope_id,
      }))
    );
    console.log(
      "All enums:",
      Array.from(index.enums.values()).map((e) => ({
        name: e.name,
        scope_id: e.defining_scope_id,
      }))
    );

    // Check class
    const myClass = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    expect(myClass).toBeDefined();
    console.log(`\n✓ MyClass: ${myClass!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myClass!.defining_scope_id === moduleScope!.id}`
    );
    expect(myClass!.defining_scope_id).toBe(moduleScope!.id);

    // Check interface
    const myInterface = Array.from(index.interfaces.values()).find(
      (i) => i.name === "MyInterface"
    );
    expect(myInterface).toBeDefined();
    console.log(`\n✓ MyInterface: ${myInterface!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myInterface!.defining_scope_id === moduleScope!.id}`
    );
    expect(myInterface!.defining_scope_id).toBe(moduleScope!.id);

    // Check enum
    const myEnum = Array.from(index.enums.values()).find(
      (e) => e.name === "MyEnum"
    );
    expect(myEnum).toBeDefined();
    console.log(`\n✓ MyEnum: ${myEnum!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myEnum!.defining_scope_id === moduleScope!.id}`
    );
    expect(myEnum!.defining_scope_id).toBe(moduleScope!.id);
  });

  it("JavaScript: class in module scope", () => {
    const code = `class MyClass {
  method() {}
}`;

    const parser = new Parser();
    parser.setLanguage(JavaScriptParser);
    const tree = parser.parse(code);
    const parsedFile = createParsedFile(
      code,
      "test.js" as FilePath,
      tree,
      "javascript" as Language
    );
    const index = build_semantic_index(
      parsedFile,
      tree,
      "javascript" as Language
    );

    const moduleScope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module" && s.parent_id === null
    );
    expect(moduleScope).toBeDefined();

    console.log("\n📋 JavaScript Scope Assignment:");
    console.log(`Module scope: ${moduleScope!.id}`);

    const myClass = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    expect(myClass).toBeDefined();
    console.log(`\n✓ MyClass: ${myClass!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myClass!.defining_scope_id === moduleScope!.id}`
    );
    expect(myClass!.defining_scope_id).toBe(moduleScope!.id);
  });

  it("Python: class in module scope", () => {
    const code = `class MyClass:
    def method(self):
        pass`;

    const parser = new Parser();
    parser.setLanguage(PythonParser);
    const tree = parser.parse(code);
    const parsedFile = createParsedFile(
      code,
      "test.py" as FilePath,
      tree,
      "python" as Language
    );
    const index = build_semantic_index(parsedFile, tree, "python" as Language);

    const moduleScope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module" && s.parent_id === null
    );
    expect(moduleScope).toBeDefined();

    console.log("\n📋 Python Scope Assignment:");
    console.log(`Module scope: ${moduleScope!.id}`);

    const myClass = Array.from(index.classes.values()).find(
      (c) => c.name === "MyClass"
    );
    expect(myClass).toBeDefined();
    console.log(`\n✓ MyClass: ${myClass!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myClass!.defining_scope_id === moduleScope!.id}`
    );
    expect(myClass!.defining_scope_id).toBe(moduleScope!.id);
  });

  it("Rust: struct, enum, trait in module scope", () => {
    const code = `struct MyStruct {
    field: i32,
}

enum MyEnum {
    A, B, C
}

trait MyTrait {
    fn method(&self);
}`;

    const parser = new Parser();
    parser.setLanguage(RustParser);
    const tree = parser.parse(code);
    const parsedFile = createParsedFile(
      code,
      "test.rs" as FilePath,
      tree,
      "rust" as Language
    );
    const index = build_semantic_index(parsedFile, tree, "rust" as Language);

    const moduleScope = Array.from(index.scopes.values()).find(
      (s) => s.type === "module" && s.parent_id === null
    );
    expect(moduleScope).toBeDefined();

    console.log("\n📋 Rust Scope Assignment:");
    console.log(`Module scope: ${moduleScope!.id}`);

    // Debug: show all scopes
    console.log(
      "\nAll scopes:",
      Array.from(index.scopes.values()).map((s) => ({
        type: s.type,
        id: s.id,
        parent_id: s.parent_id,
      }))
    );

    // Check struct
    const myStruct = Array.from(index.classes.values()).find(
      (c) => c.name === "MyStruct"
    );
    expect(myStruct).toBeDefined();
    console.log(`\n✓ MyStruct: ${myStruct!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myStruct!.defining_scope_id === moduleScope!.id}`
    );
    expect(myStruct!.defining_scope_id).toBe(moduleScope!.id);

    // Check enum
    const myEnum = Array.from(index.enums.values()).find(
      (e) => e.name === "MyEnum"
    );
    expect(myEnum).toBeDefined();
    console.log(`\n✓ MyEnum: ${myEnum!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myEnum!.defining_scope_id === moduleScope!.id}`
    );
    expect(myEnum!.defining_scope_id).toBe(moduleScope!.id);

    // Check trait
    const myTrait = Array.from(index.interfaces.values()).find(
      (i) => i.name === "MyTrait"
    );
    expect(myTrait).toBeDefined();
    console.log(`\n✓ MyTrait: ${myTrait!.defining_scope_id}`);
    console.log(
      `  In module scope? ${myTrait!.defining_scope_id === moduleScope!.id}`
    );
    expect(myTrait!.defining_scope_id).toBe(moduleScope!.id);
  });
});
