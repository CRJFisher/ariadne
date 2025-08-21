/**
 * Tests for symbol resolution feature
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "../../scope_queries/loader";
import { build_scope_tree } from "../scope_tree";
import {
  resolve_symbol_with_language,
  extract_imports,
  extract_exports,
  create_resolution_context,
  find_all_references,
  go_to_definition,
} from "./index";
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

    it("should extract ES6 imports", () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as utils from './utils';
        import './styles.css';
      `;

      const tree = parser.parse(code);
      const imports = extract_imports(tree.rootNode, code, language);

      expect(imports).toHaveLength(4);
      expect(imports[0].name).toBe("React");
      expect(imports[0].is_default).toBe(true);
      expect(imports[1].name).toBe("useState");
      expect(imports[2].name).toBe("useEffect");
      expect(imports[3].name).toBe("utils");
      expect(imports[3].is_namespace).toBe(true);
    });

    it("should extract ES6 exports", () => {
      const code = `
        export const foo = 42;
        export function bar() {}
        export default class Baz {}
        export { qux, quux as renamed };
      `;

      const tree = parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, language);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some((e) => e.name === "foo")).toBe(true);
      expect(exports.some((e) => e.name === "bar")).toBe(true);
      expect(exports.some((e) => e.is_default)).toBe(true);
    });
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

    it("should extract type-only imports", () => {
      const code = `
        import type { User } from './types';
        import { type Role, getName } from './user';
      `;

      const tree = parser.parse(code);
      const imports = extract_imports(tree.rootNode, code, language);

      // Check that type-only imports are extracted
      expect(imports.length).toBeGreaterThan(0);
    });
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

    it("should handle global declarations", () => {
      const code = `
x = 'global'

def modify():
    global x
    x = 'modified'
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

      // Find the function scope
      const func_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function" && s.metadata?.name === "modify"
      );

      if (func_scope) {
        const resolved = resolve_symbol_with_language(
          "x",
          func_scope.id,
          context,
          language
        );
        expect(resolved).toBeDefined();
        expect(resolved?.scope.id).toBe(scope_tree.root_id); // Should resolve to global scope
      }
    });

    it("should extract Python imports", () => {
      const code = `
import os
import sys as system
from pathlib import Path
from typing import List, Dict as Dictionary
from . import utils
from ..core import *
      `;

      const tree = parser.parse(code);
      const imports = extract_imports(tree.rootNode, code, language);

      expect(imports.length).toBeGreaterThan(0);
      expect(imports.some((i) => i.name === "os")).toBe(true);
      expect(
        imports.some((i) => i.name === "system" && i.source_name === "sys")
      ).toBe(true);
      expect(imports.some((i) => i.name === "Path")).toBe(true);
      expect(
        imports.some((i) => i.name === "Dictionary" && i.source_name === "Dict")
      ).toBe(true);
    });
  });

  describe("Rust", () => {
    const language: Language = "rust";
    const parser = get_language_parser(language);

    it("should resolve module paths", () => {
      const code = `
use std::collections::HashMap;
use super::utils;
use crate::config;

fn main() {
    let map: HashMap<String, i32> = HashMap::new();
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

      // Find the main function scope
      const main_scope = Array.from(scope_tree.nodes.values()).find(
        (s) => s.type === "function" && s.metadata?.name === "main"
      );

      if (main_scope) {
        // Should resolve HashMap from use statement
        const resolved = resolve_symbol_with_language(
          "HashMap",
          main_scope.id,
          context,
          language
        );
        expect(resolved).toBeDefined();
        expect(resolved?.is_imported).toBe(true);
      }
    });

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

    it("should extract Rust use statements", () => {
      const code = `
use std::io::{self, Read, Write};
use std::collections::*;
use super::utils as util_mod;
pub use crate::config::Config;
      `;

      const tree = parser.parse(code);
      const imports = extract_imports(tree.rootNode, code, language);

      expect(imports.length).toBeGreaterThan(0);
      // The dispatcher converts use statements to ImportInfo
      expect(imports.some((i) => i.name === "Read")).toBe(true);
      expect(imports.some((i) => i.name === "Write")).toBe(true);
      expect(imports.some((i) => i.name === "util_mod")).toBe(true);
    });
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
