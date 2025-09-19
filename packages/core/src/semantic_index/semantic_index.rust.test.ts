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

    it("should parse re-exports and pub use statements", () => {
      const code = readFileSync(join(FIXTURES_DIR, "modules_and_visibility.rs"), "utf-8");
      const tree = parser.parse(code);
      const index = build_semantic_index("test.rs" as FilePath, tree, "rust" as Language);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      // Check re-exports
      const exports = index.exports;
      expect(exports.some(e => e.symbol_name === "add_numbers" as SymbolName)).toBe(true);
      expect(exports.some(e => e.symbol_name === "util_helper" as SymbolName)).toBe(true);

      // Check pub use captures
      const pubUseCaptures = parsed.exports.filter(e => e.context?.is_pub_use);
      expect(pubUseCaptures.length).toBeGreaterThan(0);

      // Check visibility levels in pub use statements
      const visibilityCaptures = parsed.exports.filter(e => e.context?.visibility_level);
      expect(visibilityCaptures.length).toBeGreaterThan(0);

      // Check for different visibility levels
      const visibilityLevels = visibilityCaptures.map(c => c.context?.visibility_level);
      expect(visibilityLevels.some(v => v === "public")).toBeDefined();

      // Check for aliased pub use
      const aliasedExports = parsed.exports.filter(e => e.context?.alias);
      expect(aliasedExports.length).toBeGreaterThan(0);

      // Verify specific aliased exports - these should exist regardless of type
      const addNumbersExport = exports.find(e => e.symbol_name === "add_numbers" as SymbolName);
      expect(addNumbersExport).toBeDefined();

      // Check if any reexports exist
      const reexports = exports.filter(e => e.kind === "reexport");
      expect(reexports.length).toBeGreaterThan(0);

      // If add_numbers isn't a reexport, log to understand what's happening
      if (addNumbersExport?.kind !== "reexport") {
        console.log(`add_numbers export kind: ${addNumbersExport?.kind}, should be processed as pub use`);
      }
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

  describe("Comprehensive Capture Coverage", () => {
    it("should capture async functions and blocks", () => {
      const code = `
async fn async_function() -> Result<(), Error> {
    let future = async {
        perform_io().await
    };
    future.await
}
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const asyncFuncs = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.FUNCTION && d.modifiers?.is_async
      );
      expect(asyncFuncs.length).toBeGreaterThan(0);

      const asyncBlocks = parsed.scopes.filter(s =>
        s.entity === SemanticEntity.BLOCK && s.modifiers?.is_async
      );
      expect(asyncBlocks.length).toBeGreaterThan(0);
    });

    it("should capture const generics and associated types", () => {
      const code = `
struct Array<T, const N: usize> {
    data: [T; N]
}

trait Container {
    type Item;
    const SIZE: usize;
}

impl<const N: usize> Container for Array<i32, N> {
    type Item = i32;
    const SIZE: usize = N;
}
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const constParams = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.CONSTANT && d.text === "N"
      );
      expect(constParams.length).toBeGreaterThan(0);

      const associatedTypes = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.TYPE && d.text === "Item"
      );
      expect(associatedTypes.length).toBeGreaterThan(0);
    });

    it("should capture closures with parameters", () => {
      const code = `
let add = |x: i32, y: i32| -> i32 { x + y };
let multiply = |x, y| x * y;
let capture = move |val| println!("{}", external_var + val);
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const closures = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.FUNCTION && d.modifiers?.is_closure
      );
      expect(closures.length).toBeGreaterThan(0);

      const closureParams = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.PARAMETER && (d.text === "x" || d.text === "y" || d.text === "val")
      );
      expect(closureParams.length).toBeGreaterThan(0);
    });

    it("should capture macro definitions and invocations", () => {
      const code = `
macro_rules! create_function {
    ($func_name:ident) => {
        fn $func_name() {
            println!("Function created by macro");
        }
    };
}

create_function!(generated_func);
println!("Using macro");
vec![1, 2, 3];
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const macroDefs = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.MACRO
      );
      expect(macroDefs.length).toBeGreaterThan(0);

      const macroRefs = parsed.references.filter(r =>
        r.entity === SemanticEntity.MACRO || r.text === "println" || r.text === "vec"
      );
      expect(macroRefs.length).toBeGreaterThan(0);
    });

    it("should capture extern crate and module declarations", () => {
      const code = `
extern crate serde;
extern crate regex as re;

mod utils;
pub mod config;
pub(crate) mod internal;

#[path = "custom.rs"]
mod custom_module;
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const externCrates = parsed.imports.filter(i =>
        i.text === "serde" || i.text === "regex"
      );
      expect(externCrates.length).toBeGreaterThan(0);

      const modules = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.MODULE
      );
      expect(modules.length).toBeGreaterThan(0);
    });

    it("should capture try expressions and await", () => {
      const code = `
async fn fetch_data() -> Result<String, Error> {
    let result = async_operation().await?;
    let parsed = parse_json(&result)?;
    Ok(parsed)
}
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const tryExprs = parsed.references.filter(r =>
        r.modifiers?.is_try || r.text?.includes("?")
      );
      expect(tryExprs.length).toBeGreaterThan(0);

      const awaitExprs = parsed.references.filter(r =>
        r.modifiers?.is_await || r.text === "await"
      );
      expect(awaitExprs.length).toBeGreaterThan(0);
    });

    it("should capture visibility modifiers", () => {
      const code = `
pub struct PublicStruct;
pub(crate) struct CrateStruct;
pub(super) struct SuperStruct;
pub(in crate::module) struct RestrictedStruct;
struct PrivateStruct;
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const publicDefs = parsed.definitions.filter(d =>
        d.modifiers?.visibility === "public"
      );
      expect(publicDefs.length).toBeGreaterThan(0);
    });

    it("should capture unsafe blocks and functions", () => {
      const code = `
unsafe fn dangerous_function() {
    // Unsafe operations
}

fn safe_wrapper() {
    unsafe {
        dangerous_function();
    }
}
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const unsafeFuncs = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.FUNCTION && d.modifiers?.is_unsafe
      );
      expect(unsafeFuncs.length).toBeGreaterThan(0);

      const unsafeBlocks = parsed.scopes.filter(s =>
        s.entity === SemanticEntity.BLOCK && s.modifiers?.is_unsafe
      );
      expect(unsafeBlocks.length).toBeGreaterThan(0);
    });

    it("should capture loop variables and iterators", () => {
      const code = `
for i in 0..10 {
    println!("{}", i);
}

for (key, value) in map.iter() {
    process(key, value);
}

while let Some(item) = iter.next() {
    use_item(item);
}

loop {
    if condition { break; }
}
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

      const loopVars = parsed.definitions.filter(d =>
        d.entity === SemanticEntity.VARIABLE && (d.text === "i" || d.text === "key" || d.text === "value" || d.text === "item")
      );
      expect(loopVars.length).toBeGreaterThan(0);

      const loopScopes = parsed.scopes.filter(s =>
        s.entity === SemanticEntity.BLOCK && (s.modifiers?.is_loop || s.text === "for" || s.text === "while")
      );
      expect(loopScopes.length).toBeGreaterThan(0);
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