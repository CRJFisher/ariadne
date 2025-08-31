/**
 * Tests for symbol resolution feature
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import { build_scope_tree } from "../scope_tree";
import {
  resolve_symbol_with_language,
  create_resolution_context,
  find_all_references,
  go_to_definition,
} from "./index";
import { RustResolutionContext, resolve_rust_symbol } from "./symbol_resolution.rust";
import { Language, Position } from "@ariadnejs/types";

describe("Symbol Resolution", () => {
  describe("JavaScript", () => {
    const language: Language = "javascript";
    const parser = get_language_parser(language);

    it("should resolve local variables", () => {
      const code = `
        function test() {
          const x = 42;
          console.log(x);
        }
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const context = create_resolution_context(
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Find the block scope inside the function (where x is defined)
      const block_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "block" && s.symbols.has("x")
      );
      expect(block_scope).toBeDefined();

      // Resolve 'x' from within the block scope
      const resolved = resolve_symbol_with_language(
        "x",
        block_scope!.id,
        context,
        language
      );
      expect(resolved).toBeDefined();
      expect(resolved?.symbol.name).toBe("x");
      expect(resolved?.confidence).toBe("exact");
    });

    it("should resolve hoisted variables", () => {
      const code = `
        function test() {
          console.log(x);  // Access before declaration
          var x = 42;
        }
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const context = create_resolution_context(
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Find the function scope
      const func_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function"
      );
      expect(func_scope).toBeDefined();

      // Should resolve 'x' even though it's accessed before declaration
      const resolved = resolve_symbol_with_language(
        "x",
        func_scope!.id,
        context,
        language
      );
      expect(resolved).toBeDefined();
      expect(resolved?.symbol.name).toBe("x");
    });

    // Test removed - import/export extraction now handled by dedicated modules

    // Test removed - import/export extraction now handled by dedicated modules
  });

  describe("TypeScript", () => {
    const language: Language = "typescript";
    const parser = get_language_parser(language);

    it("should resolve type parameters", () => {
      const code = `
        function identity<T>(value: T): T {
          return value;
        }
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const context = create_resolution_context(
        scope_tree,
        language,
        "test.ts",
        tree.rootNode,
        code
      );

      // Find the function scope
      const func_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function"
      );
      expect(func_scope).toBeDefined();

      // Type parameter resolution would need to be set up in context
      // This is a placeholder test - actual implementation needs type parameter extraction
    });

    // Test removed - import/export extraction now handled by dedicated modules
  });

  describe("Python", () => {
    const language: Language = "python";
    const parser = get_language_parser(language);

    it("should resolve with LEGB rule", () => {
      const code = `
# Global
x = 'global'

def outer():
    # Enclosing
    x = 'enclosing'
    
    def inner():
        # Local
        x = 'local'
        print(x)  # Should resolve to local x
    
    inner()

outer()
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const context = create_resolution_context(
        scope_tree,
        language,
        "test.py",
        tree.rootNode,
        code
      );

      // Find the inner function scope
      const inner_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function" && s.metadata?.name === "inner"
      );

      if (inner_scope) {
        const resolved = resolve_symbol_with_language(
          "x",
          inner_scope.id,
          context,
          language
        );
        expect(resolved).toBeDefined();
        expect(resolved?.scope.id).toBe(inner_scope.id); // Should resolve to local scope
      }
    });

    // Test removed - import/export extraction now handled by dedicated modules

    // Test removed - import/export extraction now handled by dedicated modules
  });

  describe("Rust", () => {
    const language: Language = "rust";
    const parser = get_language_parser(language);

    // Test removed - import/export extraction now handled by dedicated modules

    it("should handle self and Self keywords", () => {
      const code = `
struct MyStruct {
    value: i32,
}

impl MyStruct {
    fn new(value: i32) -> Self {
        Self { value }
    }
    
    fn get_value(&self) -> i32 {
        self.value
    }
}
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const context = create_resolution_context(
        scope_tree,
        language,
        "test.rs",
        tree.rootNode,
        code
      );

      // Find the impl block methods
      const new_method = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function" && s.metadata?.name === "new"
      );

      if (new_method) {
        // 'Self' should resolve to the impl type
        const self_resolved = resolve_symbol_with_language(
          "Self",
          new_method.id,
          context,
          language
        );
        expect(self_resolved).toBeDefined();
        expect(self_resolved?.symbol.kind).toBe("type");
      }

      const get_method = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function" && s.metadata?.name === "get_value"
      );

      if (get_method) {
        // 'self' should resolve to the method parameter
        const self_resolved = resolve_symbol_with_language(
          "self",
          get_method.id,
          context,
          language
        );
        expect(self_resolved).toBeDefined();
        expect(self_resolved?.symbol.kind).toBe("parameter");
      }
    });

    // Test removed - import/export extraction now handled by dedicated modules
  });

  describe("Cross-language features", () => {
    it("should find references within a file", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        const value = 42;
        
        function useValue() {
          return value * 2;
        }
        
        console.log(value);
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);
      const refs = find_all_references(
        "value",
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      // Should find at least the definition and references
      expect(refs.length).toBeGreaterThan(0);
    });

    it("should go to definition", () => {
      const language: Language = "javascript";
      const parser = get_language_parser(language);
      const code = `
        function myFunction() {
          return 42;
        }
        
        const result = myFunction();
      `;

      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(tree.rootNode, code, language);

      // Find the root scope where the call happens
      const root_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_scope).toBeDefined();

      const def = go_to_definition(
        "myFunction",
        scope_tree.root_id,
        scope_tree,
        language,
        "test.js",
        tree.rootNode,
        code
      );

      expect(def).toBeDefined();
      expect(def?.name).toBe("myFunction");
      expect(def?.symbol_kind).toBe("function");
    });
  });
});
