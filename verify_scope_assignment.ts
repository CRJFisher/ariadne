/**
 * Script to verify scope assignment works correctly across all languages
 */

import Parser from "tree-sitter";
import TypeScriptParser from "tree-sitter-typescript";
import JavaScriptParser from "tree-sitter-javascript";
import PythonParser from "tree-sitter-python";
import RustParser from "tree-sitter-rust";
import { build_semantic_index } from "./packages/core/src/index_single_file/semantic_index";
import type { FilePath, Language } from "@ariadnejs/types";

// Helper to create parsed file
function createParsedFile(
  content: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
) {
  const lines = content.split("\n");
  const lastLine = lines[lines.length - 1] || "";
  return {
    file_path: filePath,
    file_content: content,
    file_lines: lines.length,
    file_end_column: lastLine.length > 0 ? lastLine.length : 1,
    tree,
    language,
  };
}

console.log("=".repeat(80));
console.log("SCOPE ASSIGNMENT VERIFICATION");
console.log("=".repeat(80));

// ============================================================================
// TypeScript
// ============================================================================
console.log("\n## TypeScript - Class, Interface, Enum");
console.log("-".repeat(80));

const tsCode = `class MyClass {
  method() {}
}

interface MyInterface {
  prop: string;
}

enum MyEnum {
  A, B, C
}`;

const tsParser = new Parser();
tsParser.setLanguage(TypeScriptParser.typescript);
const tsTree = tsParser.parse(tsCode);
const tsParsedFile = createParsedFile(
  tsCode,
  "test.ts" as FilePath,
  tsTree,
  "typescript" as Language
);
const tsIndex = build_semantic_index(
  tsParsedFile,
  tsTree,
  "typescript" as Language
);

// Find module scope
const tsModuleScope = Array.from(tsIndex.scopes.values()).find(
  (s) => s.type === "module" && s.parent_id === null
);
console.log("Module scope:", tsModuleScope?.id);

// Debug: show all classes
console.log("\nAll classes found:", Array.from(tsIndex.classes.keys()));

// Check class
const myClass = Array.from(tsIndex.classes.values()).find(
  (c) => c.name === "MyClass"
);
console.log("\nMyClass:");
console.log("  name:", myClass?.name);
console.log("  scope_id:", myClass?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  myClass?.defining_scope_id === tsModuleScope?.id
);
console.log("  Full object:", JSON.stringify(myClass, null, 2));

// Check interface
const myInterface = Array.from(tsIndex.interfaces.values()).find(
  (i) => i.name === "MyInterface"
);
console.log("\nMyInterface:");
console.log("  name:", myInterface?.name);
console.log("  scope_id:", myInterface?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  myInterface?.defining_scope_id === tsModuleScope?.id
);

// Check enum
const myEnum = Array.from(tsIndex.enums.values()).find(
  (e) => e.name === "MyEnum"
);
console.log("\nMyEnum:");
console.log("  name:", myEnum?.name);
console.log("  scope_id:", myEnum?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  myEnum?.defining_scope_id === tsModuleScope?.id
);

// ============================================================================
// JavaScript
// ============================================================================
console.log("\n\n## JavaScript - Class");
console.log("-".repeat(80));

const jsCode = `class MyClass {
  method() {}
}`;

const jsParser = new Parser();
jsParser.setLanguage(JavaScriptParser);
const jsTree = jsParser.parse(jsCode);
const jsParsedFile = createParsedFile(
  jsCode,
  "test.js" as FilePath,
  jsTree,
  "javascript" as Language
);
const jsIndex = build_semantic_index(
  jsParsedFile,
  jsTree,
  "javascript" as Language
);

const jsModuleScope = Array.from(jsIndex.scopes.values()).find(
  (s) => s.type === "module" && s.parent_id === null
);
console.log("Module scope:", jsModuleScope?.id);

const jsMyClass = Array.from(jsIndex.classes.values()).find(
  (c) => c.name === "MyClass"
);
console.log("\nMyClass:");
console.log("  name:", jsMyClass?.name);
console.log("  scope_id:", jsMyClass?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  jsMyClass?.defining_scope_id === jsModuleScope?.id
);

// ============================================================================
// Python
// ============================================================================
console.log("\n\n## Python - Class");
console.log("-".repeat(80));

const pyCode = `class MyClass:
    def method(self):
        pass`;

const pyParser = new Parser();
pyParser.setLanguage(PythonParser);
const pyTree = pyParser.parse(pyCode);
const pyParsedFile = createParsedFile(
  pyCode,
  "test.py" as FilePath,
  pyTree,
  "python" as Language
);
const pyIndex = build_semantic_index(
  pyParsedFile,
  pyTree,
  "python" as Language
);

const pyModuleScope = Array.from(pyIndex.scopes.values()).find(
  (s) => s.type === "module" && s.parent_id === null
);
console.log("Module scope:", pyModuleScope?.id);

const pyMyClass = Array.from(pyIndex.classes.values()).find(
  (c) => c.name === "MyClass"
);
console.log("\nMyClass:");
console.log("  name:", pyMyClass?.name);
console.log("  scope_id:", pyMyClass?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  pyMyClass?.defining_scope_id === pyModuleScope?.id
);

// ============================================================================
// Rust
// ============================================================================
console.log("\n\n## Rust - Struct, Enum, Trait, Impl");
console.log("-".repeat(80));

const rustCode = `struct MyStruct {
    field: i32,
}

enum MyEnum {
    A, B, C
}

trait MyTrait {
    fn method(&self);
}

impl MyStruct {
    fn new() -> Self {
        MyStruct { field: 0 }
    }
}`;

const rustParser = new Parser();
rustParser.setLanguage(RustParser);
const rustTree = rustParser.parse(rustCode);
const rustParsedFile = createParsedFile(
  rustCode,
  "test.rs" as FilePath,
  rustTree,
  "rust" as Language
);
const rustIndex = build_semantic_index(
  rustParsedFile,
  rustTree,
  "rust" as Language
);

const rustModuleScope = Array.from(rustIndex.scopes.values()).find(
  (s) => s.type === "module" && s.parent_id === null
);
console.log("Module scope:", rustModuleScope?.id);

// Check struct
const myStruct = Array.from(rustIndex.classes.values()).find(
  (c) => c.name === "MyStruct"
);
console.log("\nMyStruct:");
console.log("  name:", myStruct?.name);
console.log("  scope_id:", myStruct?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  myStruct?.defining_scope_id === rustModuleScope?.id
);

// Check enum
const rustMyEnum = Array.from(rustIndex.enums.values()).find(
  (e) => e.name === "MyEnum"
);
console.log("\nMyEnum:");
console.log("  name:", rustMyEnum?.name);
console.log("  scope_id:", rustMyEnum?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  rustMyEnum?.defining_scope_id === rustModuleScope?.id
);

// Check trait
const myTrait = Array.from(rustIndex.interfaces.values()).find(
  (i) => i.name === "MyTrait"
);
console.log("\nMyTrait:");
console.log("  name:", myTrait?.name);
console.log("  scope_id:", myTrait?.defining_scope_id);
console.log(
  "  ✓ In module scope?",
  myTrait?.defining_scope_id === rustModuleScope?.id
);

// Check impl - impls don't have a name, so we look at the first one
const firstImpl = Array.from(rustIndex.classes.values()).find(
  (c) => c.kind === "class" && c.name === "MyStruct" // impl blocks are stored differently
);
// Note: impl blocks may not be stored as separate definitions, they're associated with their type

console.log("\n" + "=".repeat(80));
console.log("VERIFICATION COMPLETE");
console.log("=".repeat(80));
