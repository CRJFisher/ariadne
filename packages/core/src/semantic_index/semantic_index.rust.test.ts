/**
 * Semantic index tests - Rust
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { Language, FilePath, SymbolName } from "@ariadnejs/types";
import { query_tree_and_parse_captures, build_semantic_index } from "./semantic_index";
import { SemanticEntity } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures", "rust");

describe("Semantic Index - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  describe("Basic Structs and Enums", () => {
    it("should parse struct definitions and implementations", () => {
      const code = readFileSync(join(FIXTURES_DIR, "basic_structs_and_enums.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check struct definitions
      const structs = captures.definitions.filter(c => c.entity === SemanticEntity.CLASS);
      expect(structs.length).toBeGreaterThan(0);
      expect(structs.some(s => s.text === "Point")).toBe(true);
      expect(structs.some(s => s.text === "Pair")).toBe(true);
      expect(structs.some(s => s.text === "Color")).toBe(true);

      // Check enum definitions
      const enums = captures.definitions.filter(c => c.entity === SemanticEntity.ENUM);
      expect(enums.length).toBeGreaterThan(0);
      expect(enums.some(e => e.text === "Direction")).toBe(true);
      expect(enums.some(e => e.text === "Option")).toBe(true);
      expect(enums.some(e => e.text === "Message")).toBe(true);

      // Check enum variants
      const variants = captures.definitions.filter(c => c.entity === SemanticEntity.ENUM_MEMBER);
      expect(variants.some(v => v.text === "North")).toBe(true);
      expect(variants.some(v => v.text === "Some")).toBe(true);
      expect(variants.some(v => v.text === "Quit")).toBe(true);

      // Check methods
      const methods = captures.definitions.filter(c => c.entity === SemanticEntity.METHOD);
      expect(methods.some(m => m.text === "new")).toBe(true);
      expect(methods.some(m => m.text === "distance")).toBe(true);
      expect(methods.some(m => m.text === "translate")).toBe(true);

      // Check impl blocks
      const implBlocks = captures.scopes.filter(c => c.entity === SemanticEntity.CLASS);
      expect(implBlocks.length).toBeGreaterThan(0);
    });

    it("should distinguish between associated functions and methods", () => {
      const code = readFileSync(join(FIXTURES_DIR, "basic_structs_and_enums.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const methods = captures.definitions.filter(c => c.entity === SemanticEntity.METHOD);

      // new() should be marked as a constructor or associated function
      const newMethod = methods.find(m => m.text === "new");
      expect(newMethod).toBeDefined();
      expect(newMethod?.modifiers?.is_constructor || newMethod?.modifiers?.is_static).toBe(true);

      // distance() should be a regular method
      const distanceMethod = methods.find(m => m.text === "distance");
      expect(distanceMethod).toBeDefined();
      expect(distanceMethod?.modifiers?.is_static).not.toBe(true);
    });
  });

  describe("Traits and Generics", () => {
    it("should parse trait definitions and implementations", () => {
      const code = readFileSync(join(FIXTURES_DIR, "traits_and_generics.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check trait definitions
      const traits = captures.definitions.filter(c => c.entity === SemanticEntity.INTERFACE);
      expect(traits.some(t => t.text === "Drawable")).toBe(true);
      expect(traits.some(t => t.text === "Iterator")).toBe(true);
      expect(traits.some(t => t.text === "Container")).toBe(true);
      expect(traits.some(t => t.text === "Greet")).toBe(true);

      // Check generic parameters
      const typeParams = captures.definitions.filter(c => c.entity === SemanticEntity.TYPE_PARAMETER);
      expect(typeParams.length).toBeGreaterThan(0);

      // Check trait methods
      const traitMethods = captures.definitions.filter(c =>
        c.entity === SemanticEntity.METHOD && c.modifiers?.is_trait_method
      );
      expect(traitMethods.some(m => m.text === "draw")).toBe(true);
      expect(traitMethods.some(m => m.text === "next")).toBe(true);
    });

    it("should parse generic types and constraints", () => {
      const code = readFileSync(join(FIXTURES_DIR, "traits_and_generics.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check generic structs
      const genericStructs = captures.definitions.filter(c =>
        c.entity === SemanticEntity.CLASS && c.modifiers?.is_generic
      );
      expect(genericStructs.some(s => s.text === "Stack")).toBe(true);

      // Check type constraints
      const typeConstraints = captures.types.filter(c => c.entity === SemanticEntity.TYPE_CONSTRAINT);
      expect(typeConstraints.length).toBeGreaterThan(0);

      // Check const generics
      const constGenerics = captures.definitions.filter(c => c.text === "Array");
      expect(constGenerics.length).toBeGreaterThan(0);
    });

    it("should parse trait implementations", () => {
      const code = readFileSync(join(FIXTURES_DIR, "traits_and_generics.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check that trait implementations are captured
      const traitImpls = Array.from(index.symbols.values()).filter(s =>
        s.kind === "method" && s.name === "draw"
      );
      expect(traitImpls.length).toBeGreaterThan(0);
    });
  });

  describe("Functions and Closures", () => {
    it("should parse function definitions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions_and_closures.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check function definitions
      const functions = captures.definitions.filter(c => c.entity === SemanticEntity.FUNCTION);
      expect(functions.some(f => f.text === "add")).toBe(true);
      expect(functions.some(f => f.text === "first_word")).toBe(true);
      expect(functions.some(f => f.text === "longest")).toBe(true);

      // Check async functions
      const asyncFunctions = functions.filter(f => f.modifiers?.is_async);
      expect(asyncFunctions.some(f => f.text === "fetch_data")).toBe(true);

      // Check generic functions
      const genericFunctions = functions.filter(f => f.modifiers?.is_generic);
      expect(genericFunctions.some(f => f.text === "swap")).toBe(true);
    });

    it("should parse closures", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions_and_closures.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check closure scopes
      const closureScopes = captures.scopes.filter(c =>
        c.entity === SemanticEntity.FUNCTION && c.modifiers?.is_closure
      );
      expect(closureScopes.length).toBeGreaterThan(0);

      // Check closure parameters
      const closureParams = captures.definitions.filter(c =>
        c.entity === SemanticEntity.PARAMETER && c.modifiers?.is_closure_param
      );
      expect(closureParams.length).toBeGreaterThan(0);
    });

    it("should parse function parameters and return types", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions_and_closures.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check parameters
      const params = Array.from(index.symbols.values()).filter(s => s.kind === "parameter");
      expect(params.length).toBeGreaterThan(0);

      // Check self parameters
      const selfParams = params.filter(p => p.name === "self");
      expect(selfParams.length).toBeGreaterThan(0);
    });
  });

  describe("Modules and Visibility", () => {
    it("should parse module declarations and visibility modifiers", () => {
      const code = readFileSync(join(FIXTURES_DIR, "modules_and_visibility.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check module definitions
      const modules = captures.definitions.filter(c => c.entity === SemanticEntity.MODULE);
      expect(modules.some(m => m.text === "math")).toBe(true);
      expect(modules.some(m => m.text === "utils")).toBe(true);
      expect(modules.some(m => m.text === "internal")).toBe(true);

      // Check visibility modifiers
      const visibility = captures.modifiers.filter(c => c.entity === SemanticEntity.VISIBILITY);
      expect(visibility.length).toBeGreaterThan(0);

      // Check exports (public items)
      const exports = captures.exports;
      expect(exports.some(e => e.text === "add")).toBe(true);
      expect(exports.some(e => e.text === "User")).toBe(true);
    });

    it("should parse use statements and imports", () => {
      const code = readFileSync(join(FIXTURES_DIR, "modules_and_visibility.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check imports
      const imports = captures.imports;
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.some(i => i.text === "HashMap")).toBe(true);
      expect(imports.some(i => i.text === "Display")).toBe(true);

      // Check aliased imports
      const aliasedImports = imports.filter(i => i.context?.import_alias);
      expect(aliasedImports.length).toBeGreaterThan(0);

      // Check wildcard imports
      const wildcardImports = imports.filter(i => i.modifiers?.is_wildcard);
      expect(wildcardImports.length).toBeGreaterThan(0);
    });

    it("should parse re-exports", () => {
      const code = readFileSync(join(FIXTURES_DIR, "modules_and_visibility.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check re-exports
      const exports = index.exports;
      expect(exports.some(e => e.name === "add_numbers" as SymbolName)).toBe(true);
      expect(exports.some(e => e.name === "util_helper" as SymbolName)).toBe(true);
    });
  });

  describe("Ownership and Pattern Matching", () => {
    it("should parse lifetime annotations", () => {
      const code = readFileSync(join(FIXTURES_DIR, "ownership_and_patterns.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check lifetime parameters
      const lifetimes = captures.definitions.filter(c =>
        c.entity === SemanticEntity.TYPE_PARAMETER && c.modifiers?.is_lifetime
      );
      expect(lifetimes.length).toBeGreaterThan(0);

      // Check structs with lifetimes
      const bookStruct = captures.definitions.find(c =>
        c.entity === SemanticEntity.CLASS && c.text === "Book"
      );
      expect(bookStruct).toBeDefined();
    });

    it("should parse pattern matching constructs", () => {
      const code = readFileSync(join(FIXTURES_DIR, "ownership_and_patterns.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check match expressions
      const matchScopes = captures.scopes.filter(c =>
        c.modifiers?.match_type === "match"
      );
      expect(matchScopes.length).toBeGreaterThan(0);

      // Check match arm scopes
      const matchArmScopes = captures.scopes.filter(c =>
        c.modifiers?.match_type === "arm"
      );
      expect(matchArmScopes.length).toBeGreaterThan(0);

      // Check pattern variables
      const patternVars = captures.definitions.filter(c =>
        c.entity === SemanticEntity.VARIABLE && c.modifiers?.is_pattern_var
      );
      expect(patternVars.length).toBeGreaterThan(0);
    });

    it("should parse references and dereferences", () => {
      const code = readFileSync(join(FIXTURES_DIR, "ownership_and_patterns.rs"), "utf-8");
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check borrow operations
      const borrows = captures.references.filter(c =>
        c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_borrow
      );
      expect(borrows.length).toBeGreaterThan(0);

      // Check dereference operations
      const derefs = captures.references.filter(c =>
        c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_dereference
      );
      expect(derefs.length).toBeGreaterThan(0);
    });

    it("should parse smart pointer types", () => {
      const code = readFileSync(join(FIXTURES_DIR, "ownership_and_patterns.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check for Box, Rc, RefCell usage
      const references = index.references;
      expect(references.calls.some(r => r.name === "Box" as SymbolName)).toBe(true);
      expect(references.calls.some(r => r.name === "Rc" as SymbolName)).toBe(true);
      expect(references.calls.some(r => r.name === "RefCell" as SymbolName)).toBe(true);
    });
  });

  describe("Method Calls and Type Resolution", () => {
    it("should track method calls with receivers", () => {
      const code = `
        struct Calculator;
        impl Calculator {
            fn add(&self, a: i32, b: i32) -> i32 { a + b }
        }
        fn main() {
            let calc = Calculator;
            calc.add(1, 2);
        }
      `;
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check method calls
      const methodCalls = index.references.calls;
      expect(methodCalls.length).toBeGreaterThan(0);
      expect(methodCalls.some(m => m.name === "add" as SymbolName)).toBe(true);
    });

    it("should handle chained method calls", () => {
      const code = `
        struct Builder;
        impl Builder {
            fn new() -> Self { Builder }
            fn with_value(self, v: i32) -> Self { self }
            fn build(self) -> String { String::new() }
        }
        fn main() {
            Builder::new().with_value(42).build();
        }
      `;
      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check for chained method calls
      const chainedCalls = captures.references.filter(c =>
        c.entity === SemanticEntity.METHOD
      );
      expect(chainedCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Type System Integration", () => {
    it("should build type registry with Rust types", () => {
      const code = readFileSync(join(FIXTURES_DIR, "basic_structs_and_enums.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check type registry
      expect(index.type_registry.name_to_type.has("Point" as SymbolName)).toBe(true);
      expect(index.type_registry.name_to_type.has("Direction" as SymbolName)).toBe(true);
      expect(index.type_registry.name_to_type.has("Message" as SymbolName)).toBe(true);

      // Check type members
      const pointType = index.type_registry.name_to_type.get("Point" as SymbolName);
      expect(pointType).toBeDefined();
      const pointMembers = index.type_members.instance_members.get(pointType!);
      expect(pointMembers).toBeDefined();
      expect(pointMembers?.has("new" as SymbolName)).toBe(true);
      expect(pointMembers?.has("distance" as SymbolName)).toBe(true);
    });

    it("should handle trait implementations in type system", () => {
      const code = readFileSync(join(FIXTURES_DIR, "traits_and_generics.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);

      // Check that types implementing traits are registered
      const circleType = index.type_registry.name_to_type.get("Circle" as SymbolName);
      expect(circleType).toBeDefined();

      // Check type members include trait methods
      const circleMembers = index.type_members.instance_members.get(circleType!);
      expect(circleMembers?.has("draw" as SymbolName)).toBe(true);
    });
  });
});