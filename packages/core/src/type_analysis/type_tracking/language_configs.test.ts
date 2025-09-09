/**
 * Tests for language configurations
 */

import { describe, it, expect } from "vitest";
import {
  get_type_tracking_config,
  is_assignment_node,
  get_literal_type,
  get_collection_type,
} from "./language_configs";

describe("Language Configurations", () => {
  describe("JavaScript configuration", () => {
    const config = get_type_tracking_config("javascript");

    it("should identify assignment nodes", () => {
      expect(is_assignment_node("variable_declarator", config)).toBe(true);
      expect(is_assignment_node("assignment_expression", config)).toBe(true);
      expect(is_assignment_node("function_declaration", config)).toBe(false);
    });

    it("should identify literal types", () => {
      expect(get_literal_type("string", config)?.type_name).toBe("string");
      expect(get_literal_type("number", config)?.type_name).toBe("number");
      expect(get_literal_type("true", config)?.type_name).toBe("boolean");
      expect(get_literal_type("false", config)?.type_name).toBe("boolean");
      expect(get_literal_type("null", config)?.type_name).toBe("null");
      expect(get_literal_type("undefined", config)?.type_name).toBe(
        "undefined"
      );
    });

    it("should identify collection types", () => {
      expect(get_collection_type("array", config)?.type_name).toBe("Array");
      expect(get_collection_type("object", config)?.type_name).toBe("Object");
    });

    it("should have correct feature flags", () => {
      expect(config.features.has_type_annotations).toBe(false);
      expect(config.features.has_generics).toBe(false);
      expect(config.features.has_duck_typing).toBe(true);
    });
  });

  describe("TypeScript configuration", () => {
    const config = get_type_tracking_config("typescript");

    it("should inherit JavaScript configuration", () => {
      expect(config.assignment_nodes.variable_declaration).toBe(
        "variable_declarator"
      );
      expect(config.assignment_nodes.assignment_expression).toBe(
        "assignment_expression"
      );
    });

    it("should have TypeScript-specific features", () => {
      expect(config.features.has_type_annotations).toBe(true);
      expect(config.features.has_generics).toBe(true);
      expect(config.features.has_interfaces).toBe(true);
      expect(config.features.has_type_aliases).toBe(true);
    });

    it("should have type annotation nodes", () => {
      expect(config.type_annotations).toBeDefined();
      expect(config.type_annotations?.type_annotation).toBe("type_annotation");
      expect(config.type_annotations?.type_identifier).toBe("type_identifier");
      expect(config.type_annotations?.predefined_type).toBe("predefined_type");
      expect(config.type_annotations?.generic_type).toBe("generic_type");
    });
  });

  describe("Python configuration", () => {
    const config = get_type_tracking_config("python");

    it("should identify Python assignment nodes", () => {
      expect(is_assignment_node("assignment", config)).toBe(true);
      expect(is_assignment_node("annotated_assignment", config)).toBe(true);
      expect(is_assignment_node("augmented_assignment", config)).toBe(true);
    });

    it("should identify Python literal types", () => {
      expect(get_literal_type("string", config)?.type_name).toBe("str");
      expect(get_literal_type("integer", config)?.type_name).toBe("int");
      expect(get_literal_type("float", config)?.type_name).toBe("int"); // Will be refined in generic processor
      expect(get_literal_type("true", config)?.type_name).toBe("bool");
      expect(get_literal_type("false", config)?.type_name).toBe("bool");
      expect(get_literal_type("none", config)?.type_name).toBe("None");
    });

    it("should identify Python collection types", () => {
      expect(get_collection_type("list", config)?.type_name).toBe("list");
      expect(get_collection_type("dictionary", config)?.type_name).toBe("dict");
      expect(get_collection_type("set", config)?.type_name).toBe("set");
    });

    it("should have Python-specific features", () => {
      expect(config.features.has_type_annotations).toBe(true);
      expect(config.features.has_duck_typing).toBe(true);
      expect(config.features.has_ownership).toBe(false);
    });
  });

  describe("Rust configuration", () => {
    const config = get_type_tracking_config("rust");

    it("should identify Rust assignment nodes", () => {
      expect(is_assignment_node("let_declaration", config)).toBe(true);
      expect(is_assignment_node("assignment_expression", config)).toBe(true);
    });

    it("should identify Rust literal types", () => {
      expect(get_literal_type("string_literal", config)?.type_name).toBe(
        "&str"
      );
      expect(get_literal_type("integer_literal", config)?.type_name).toBe(
        "i32"
      );
      expect(get_literal_type("float_literal", config)?.type_name).toBe("i32"); // Will be refined
      expect(get_literal_type("boolean_literal", config)?.type_name).toBe(
        "bool"
      );
      expect(get_literal_type("unit_expression", config)?.type_name).toBe("()");
    });

    it("should identify Rust collection types", () => {
      expect(get_collection_type("array_expression", config)?.type_name).toBe(
        "Vec"
      );
      expect(get_collection_type("struct_expression", config)?.type_name).toBe(
        "struct"
      );
    });

    it("should have Rust-specific features", () => {
      expect(config.features.has_type_annotations).toBe(true);
      expect(config.features.has_ownership).toBe(true);
      expect(config.features.has_traits).toBe(true);
      expect(config.features.has_duck_typing).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should throw for unsupported language", () => {
      expect(() => get_type_tracking_config("ruby" as any)).toThrow(
        "Unsupported language: ruby"
      );
    });
  });
});

describe("Configuration coverage", () => {
  it("should cover all major AST node types", () => {
    const languages = ["javascript", "typescript", "python", "rust"] as const;

    for (const lang of languages) {
      const config = get_type_tracking_config(lang);

      // Check essential fields exist
      expect(config.assignment_nodes).toBeDefined();
      expect(config.field_names).toBeDefined();
      expect(config.literal_types).toBeDefined();
      expect(config.collection_types).toBeDefined();
      expect(config.import_patterns).toBeDefined();
      expect(config.export_patterns).toBeDefined();
      expect(config.class_patterns).toBeDefined();
      expect(config.function_patterns).toBeDefined();
      expect(config.features).toBeDefined();
    }
  });

  it("should have consistent field names across configurations", () => {
    const configs = {
      javascript: get_type_tracking_config("javascript"),
      typescript: get_type_tracking_config("typescript"),
      python: get_type_tracking_config("python"),
      rust: get_type_tracking_config("rust"),
    };

    // All configs should have these basic field names
    for (const [lang, config] of Object.entries(configs)) {
      expect(config.field_names.name).toBeDefined();
      expect(config.field_names.value).toBeDefined();
      // Type field is optional
      if (lang === "typescript" || lang === "python" || lang === "rust") {
        expect(config.field_names.type).toBeDefined();
      }
    }
  });
});
