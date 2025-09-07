/**
 * Tests for language scope configurations
 */

import { describe, it, expect } from "vitest";
import {
  get_language_config,
  creates_scope,
  get_scope_type,
  should_hoist_symbol,
  is_builtin_symbol,
} from "./language_configs";

describe("Language Configs", () => {
  describe("get_language_config", () => {
    it("should return config for JavaScript", () => {
      const config = get_language_config("javascript");
      expect(config).toBeDefined();
      expect(config.features.has_hoisting).toBe(true);
      expect(config.features.has_block_scopes).toBe(true);
    });

    it("should return config for TypeScript", () => {
      const config = get_language_config("typescript");
      expect(config).toBeDefined();
      expect(config.features.has_type_scopes).toBe(true);
    });

    it("should return config for Python", () => {
      const config = get_language_config("python");
      expect(config).toBeDefined();
      expect(config.features.has_scope_modifiers).toBe(true);
      expect(config.features.has_block_scopes).toBe(false);
    });

    it("should return config for Rust", () => {
      const config = get_language_config("rust");
      expect(config).toBeDefined();
      expect(config.features.has_block_scopes).toBe(true);
    });
  });

  describe("creates_scope", () => {
    it("should identify JavaScript scope-creating nodes", () => {
      expect(creates_scope("function_declaration", "javascript")).toBe(true);
      expect(creates_scope("arrow_function", "javascript")).toBe(true);
      expect(creates_scope("class_declaration", "javascript")).toBe(true);
      expect(creates_scope("for_statement", "javascript")).toBe(true);
      expect(creates_scope("variable_declarator", "javascript")).toBe(false);
    });

    it("should identify TypeScript scope-creating nodes", () => {
      expect(creates_scope("interface_declaration", "typescript")).toBe(true);
      expect(creates_scope("internal_module", "typescript")).toBe(true);
      expect(creates_scope("enum_declaration", "typescript")).toBe(true);
    });

    it("should identify Python scope-creating nodes", () => {
      expect(creates_scope("function_definition", "python")).toBe(true);
      expect(creates_scope("class_definition", "python")).toBe(true);
      expect(creates_scope("list_comprehension", "python")).toBe(true);
      expect(creates_scope("with_statement", "python")).toBe(true);
      expect(creates_scope("if_statement", "python")).toBe(false);
    });

    it("should identify Rust scope-creating nodes", () => {
      expect(creates_scope("function_item", "rust")).toBe(true);
      expect(creates_scope("impl_item", "rust")).toBe(true);
      expect(creates_scope("match_arm", "rust")).toBe(true);
      expect(creates_scope("unsafe_block", "rust")).toBe(true);
    });
  });

  describe("get_scope_type", () => {
    it("should return correct scope types for JavaScript", () => {
      expect(get_scope_type("function_declaration", "javascript")).toBe("function");
      expect(get_scope_type("class_declaration", "javascript")).toBe("class");
      expect(get_scope_type("for_statement", "javascript")).toBe("block");
      expect(get_scope_type("statement_block", "javascript")).toBe("block");
    });

    it("should return correct scope types for TypeScript", () => {
      expect(get_scope_type("interface_declaration", "typescript")).toBe("class");
      expect(get_scope_type("internal_module", "typescript")).toBe("module");
      expect(get_scope_type("enum_declaration", "typescript")).toBe("class");
    });

    it("should return correct scope types for Python", () => {
      expect(get_scope_type("function_definition", "python")).toBe("function");
      expect(get_scope_type("class_definition", "python")).toBe("class");
      expect(get_scope_type("list_comprehension", "python")).toBe("block");
    });

    it("should return correct scope types for Rust", () => {
      expect(get_scope_type("function_item", "rust")).toBe("function");
      expect(get_scope_type("impl_item", "rust")).toBe("class");
      expect(get_scope_type("mod_item", "rust")).toBe("module");
      expect(get_scope_type("block", "rust")).toBe("block");
    });
  });

  describe("should_hoist_symbol", () => {
    it("should identify hoisted symbols in JavaScript", () => {
      expect(should_hoist_symbol("function_declaration", "javascript")).toBe(true);
      expect(should_hoist_symbol("variable_declarator", "javascript")).toBe(false);
      expect(should_hoist_symbol("class_declaration", "javascript")).toBe(false);
    });

    it("should return false for non-hoisting languages", () => {
      expect(should_hoist_symbol("function_definition", "python")).toBe(false);
      expect(should_hoist_symbol("function_item", "rust")).toBe(false);
    });
  });

  describe("is_builtin_symbol", () => {
    it("should identify JavaScript builtins", () => {
      expect(is_builtin_symbol("console", "javascript")).toBe(true);
      expect(is_builtin_symbol("Array", "javascript")).toBe(true);
      expect(is_builtin_symbol("Promise", "javascript")).toBe(true);
      expect(is_builtin_symbol("myVariable", "javascript")).toBe(false);
    });

    it("should identify Python builtins", () => {
      expect(is_builtin_symbol("print", "python")).toBe(true);
      expect(is_builtin_symbol("len", "python")).toBe(true);
      expect(is_builtin_symbol("True", "python")).toBe(true);
      expect(is_builtin_symbol("myFunction", "python")).toBe(false);
    });

    it("should identify Rust prelude items", () => {
      expect(is_builtin_symbol("Option", "rust")).toBe(true);
      expect(is_builtin_symbol("Vec", "rust")).toBe(true);
      expect(is_builtin_symbol("std", "rust")).toBe(true);
      expect(is_builtin_symbol("my_struct", "rust")).toBe(false);
    });
  });

  describe("Configuration completeness", () => {
    it("should have parameter nodes defined for all languages", () => {
      const languages = ["javascript", "typescript", "python", "rust"] as const;
      
      for (const lang of languages) {
        const config = get_language_config(lang);
        expect(config.parameter_nodes).toBeDefined();
        expect(config.parameter_nodes.length).toBeGreaterThan(0);
      }
    });

    it("should have assignment nodes defined for all languages", () => {
      const languages = ["javascript", "typescript", "python", "rust"] as const;
      
      for (const lang of languages) {
        const config = get_language_config(lang);
        expect(config.assignment_nodes).toBeDefined();
        expect(Object.keys(config.assignment_nodes).length).toBeGreaterThan(0);
      }
    });

    it("should have symbol defining nodes for all languages", () => {
      const languages = ["javascript", "typescript", "python", "rust"] as const;
      
      for (const lang of languages) {
        const config = get_language_config(lang);
        expect(config.symbol_defining_nodes).toBeDefined();
        expect(Object.keys(config.symbol_defining_nodes).length).toBeGreaterThan(0);
      }
    });
  });
});