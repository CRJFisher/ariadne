/**
 * Tests for language configurations
 */

import { describe, it, expect } from "vitest";
import {
  get_symbol_resolution_config,
  is_global_symbol,
  is_builtin_symbol,
  is_function_hoisted,
  get_scope_search_order,
  requires_bespoke_handling,
  get_bespoke_handler,
} from "./language_configs";

describe("Language Configurations", () => {
  describe("JavaScript Configuration", () => {
    const config = get_symbol_resolution_config("javascript");

    it("should have correct scope traversal settings", () => {
      expect(config.scope_traversal.search_order).toBe("local_first");
      expect(config.scope_traversal.search_parent_scopes).toBe(true);
    });

    it("should have correct hoisting rules", () => {
      expect(config.declaration_rules.hoist_functions).toBe(true);
      expect(config.declaration_rules.hoist_variables).toBe(false);
      expect(config.declaration_rules.hoist_classes).toBe(false);
    });

    it("should recognize global symbols", () => {
      expect(is_global_symbol("window", "javascript")).toBe(true);
      expect(is_global_symbol("console", "javascript")).toBe(true);
      expect(is_global_symbol("process", "javascript")).toBe(true);
      expect(is_global_symbol("foo", "javascript")).toBe(false);
    });

    it("should recognize builtin symbols", () => {
      expect(is_builtin_symbol("Array", "javascript")).toBe(true);
      expect(is_builtin_symbol("Promise", "javascript")).toBe(true);
      expect(is_builtin_symbol("foo", "javascript")).toBe(false);
    });

    it("should have bespoke handlers", () => {
      expect(requires_bespoke_handling("hoisting", "javascript")).toBe(true);
      expect(requires_bespoke_handling("prototype_chain", "javascript")).toBe(true);
      expect(get_bespoke_handler("hoisting", "javascript")).toBe("handle_javascript_hoisting");
    });
  });

  describe("TypeScript Configuration", () => {
    const config = get_symbol_resolution_config("typescript");

    it("should extend JavaScript configuration", () => {
      expect(config.scope_traversal.search_order).toBe("local_first");
      expect(config.declaration_rules.hoist_functions).toBe(true);
    });

    it("should have TypeScript-specific features", () => {
      expect(config.name_patterns?.type_namespaces).toBe(true);
      expect(requires_bespoke_handling("interface_merging", "typescript")).toBe(true);
      expect(requires_bespoke_handling("namespaces", "typescript")).toBe(true);
      expect(requires_bespoke_handling("decorators", "typescript")).toBe(true);
    });
  });

  describe("Python Configuration", () => {
    const config = get_symbol_resolution_config("python");

    it("should use LEGB rule", () => {
      expect(config.scope_traversal.search_order).toBe("custom");
      expect(config.scope_traversal.custom_order).toEqual(["local", "enclosing", "global", "builtin"]);
    });

    it("should not hoist declarations", () => {
      expect(config.declaration_rules.hoist_functions).toBe(false);
      expect(config.declaration_rules.hoist_variables).toBe(false);
      expect(config.declaration_rules.require_declaration_before_use).toBe(true);
    });

    it("should recognize Python builtins", () => {
      expect(is_builtin_symbol("print", "python")).toBe(true);
      expect(is_builtin_symbol("len", "python")).toBe(true);
      expect(is_builtin_symbol("range", "python")).toBe(true);
    });

    it("should have Python-specific handlers", () => {
      expect(requires_bespoke_handling("legb_rule", "python")).toBe(true);
      expect(requires_bespoke_handling("global_nonlocal", "python")).toBe(true);
      expect(get_bespoke_handler("legb_rule", "python")).toBe("handle_python_legb");
    });
  });

  describe("Rust Configuration", () => {
    const config = get_symbol_resolution_config("rust");

    it("should have private by default visibility", () => {
      expect(config.visibility_rules.default_public).toBe(false);
      expect(config.visibility_rules.visibility_keywords).toContain("pub");
    });

    it("should use :: as module separator", () => {
      expect(config.name_patterns?.module_separator).toBe("::");
    });

    it("should recognize Rust special symbols", () => {
      expect(is_global_symbol("crate", "rust")).toBe(true);
      expect(is_global_symbol("super", "rust")).toBe(true);
      expect(is_global_symbol("self", "rust")).toBe(true);
    });

    it("should have Rust-specific handlers", () => {
      expect(requires_bespoke_handling("module_paths", "rust")).toBe(true);
      expect(requires_bespoke_handling("impl_blocks", "rust")).toBe(true);
      expect(get_bespoke_handler("use_statements", "rust")).toBe("handle_use_statements");
    });
  });

  describe("Helper Functions", () => {
    it("should determine if functions are hoisted", () => {
      expect(is_function_hoisted("javascript")).toBe(true);
      expect(is_function_hoisted("typescript")).toBe(true);
      expect(is_function_hoisted("python")).toBe(false);
      expect(is_function_hoisted("rust")).toBe(false);
    });

    it("should get correct scope search order", () => {
      expect(get_scope_search_order("javascript")).toEqual(["local", "parent", "global"]);
      expect(get_scope_search_order("python")).toEqual(["local", "enclosing", "global", "builtin"]);
    });
  });
});