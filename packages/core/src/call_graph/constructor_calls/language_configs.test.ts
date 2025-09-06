/**
 * Tests for language-specific configurations
 */

import { describe, it, expect } from "vitest";
import {
  get_language_config,
  is_constructor_node_type,
  is_potential_constructor_node_type,
  matches_constructor_naming,
  is_factory_method_name,
  get_arguments_field_name
} from "./language_configs";

describe("Language Configurations", () => {
  describe("JavaScript Configuration", () => {
    it("should identify new_expression as constructor node type", () => {
      expect(is_constructor_node_type("new_expression", "javascript")).toBe(true);
      expect(is_constructor_node_type("call_expression", "javascript")).toBe(false);
    });

    it("should identify call_expression as potential constructor", () => {
      expect(is_potential_constructor_node_type("call_expression", "javascript")).toBe(true);
      expect(is_potential_constructor_node_type("new_expression", "javascript")).toBe(false);
    });

    it("should match capitalized names as constructors", () => {
      expect(matches_constructor_naming("Component", "javascript")).toBe(true);
      expect(matches_constructor_naming("MyClass", "javascript")).toBe(true);
      expect(matches_constructor_naming("doSomething", "javascript")).toBe(false);
      expect(matches_constructor_naming("render", "javascript")).toBe(false);
    });

    it("should have correct field configurations", () => {
      const config = get_language_config("javascript");
      expect(config.arguments_field_name).toBe("arguments");
      expect(config.name_extraction_fields.new_expression.primary_field).toBe("constructor");
      expect(config.name_extraction_fields.call_expression.primary_field).toBe("function");
    });
  });

  describe("TypeScript Configuration", () => {
    it("should extend JavaScript configuration", () => {
      const jsConfig = get_language_config("javascript");
      const tsConfig = get_language_config("typescript");
      
      // Should have same constructor node types
      expect(tsConfig.constructor_node_types).toEqual(jsConfig.constructor_node_types);
      expect(tsConfig.potential_constructor_node_types).toEqual(jsConfig.potential_constructor_node_types);
    });

    it("should handle generic type parameters", () => {
      const config = get_language_config("typescript");
      expect(config.name_extraction_fields.new_expression.nested_path).toContain("generic_type.name");
    });
  });

  describe("Python Configuration", () => {
    it("should not have explicit constructor syntax", () => {
      const config = get_language_config("python");
      expect(config.constructor_node_types).toEqual([]);
    });

    it("should identify call as potential constructor", () => {
      expect(is_potential_constructor_node_type("call", "python")).toBe(true);
      expect(is_constructor_node_type("call", "python")).toBe(false);
    });

    it("should match capitalized names as classes", () => {
      expect(matches_constructor_naming("Person", "python")).toBe(true);
      expect(matches_constructor_naming("DataClass", "python")).toBe(true);
      expect(matches_constructor_naming("process_data", "python")).toBe(false);
      expect(matches_constructor_naming("__init__", "python")).toBe(false);
    });

    it("should use 'function' field for call nodes", () => {
      const config = get_language_config("python");
      expect(config.name_extraction_fields.call.primary_field).toBe("function");
    });
  });

  describe("Rust Configuration", () => {
    it("should identify struct_expression as constructor", () => {
      expect(is_constructor_node_type("struct_expression", "rust")).toBe(true);
      expect(is_constructor_node_type("call_expression", "rust")).toBe(false);
    });

    it("should identify call_expression as potential constructor", () => {
      expect(is_potential_constructor_node_type("call_expression", "rust")).toBe(true);
    });

    it("should recognize factory method names", () => {
      expect(is_factory_method_name("new", "rust")).toBe(true);
      expect(is_factory_method_name("create", "rust")).toBe(true);
      expect(is_factory_method_name("from", "rust")).toBe(true);
      expect(is_factory_method_name("build", "rust")).toBe(true);
      expect(is_factory_method_name("default", "rust")).toBe(true);
      expect(is_factory_method_name("with_capacity", "rust")).toBe(true);
      expect(is_factory_method_name("parse", "rust")).toBe(true);
      expect(is_factory_method_name("process", "rust")).toBe(false);
    });

    it("should have special node types configured", () => {
      const config = get_language_config("rust");
      expect(config.special_node_types?.struct_literal).toBe("struct_expression");
      expect(config.special_node_types?.enum_variant).toBe("call_expression");
    });

    it("should extract names from struct expressions", () => {
      const config = get_language_config("rust");
      expect(config.name_extraction_fields.struct_expression.primary_field).toBe("name");
      expect(config.name_extraction_fields.struct_expression.nested_path).toContain("type_identifier");
    });
  });

  describe("Cross-language comparisons", () => {
    it("should all use 'arguments' as the field name", () => {
      expect(get_arguments_field_name("javascript")).toBe("arguments");
      expect(get_arguments_field_name("typescript")).toBe("arguments");
      expect(get_arguments_field_name("python")).toBe("arguments");
      expect(get_arguments_field_name("rust")).toBe("arguments");
    });

    it("should have different constructor detection strategies", () => {
      // JavaScript/TypeScript use 'new' keyword
      const jsConfig = get_language_config("javascript");
      const tsConfig = get_language_config("typescript");
      expect(jsConfig.constructor_node_types).toContain("new_expression");
      expect(tsConfig.constructor_node_types).toContain("new_expression");
      
      // Python uses capitalization convention
      const pyConfig = get_language_config("python");
      expect(pyConfig.constructor_node_types).toEqual([]);
      expect(pyConfig.identification_rules.capitalization_pattern).toBeDefined();
      
      // Rust uses struct literals and factory methods
      const rustConfig = get_language_config("rust");
      expect(rustConfig.constructor_node_types).toContain("struct_expression");
      expect(rustConfig.identification_rules.factory_method_names).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should throw error for unsupported language", () => {
      expect(() => get_language_config("unknown" as any)).toThrow(
        "No constructor configuration for language: unknown"
      );
    });
  });
});