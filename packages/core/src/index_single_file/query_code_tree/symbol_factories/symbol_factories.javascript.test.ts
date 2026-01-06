/**
 * Tests for JavaScript symbol factories
 */

import { describe, it, expect } from "vitest";
import {
  create_class_id,
  create_method_id,
  create_function_id,
  create_variable_id,
  create_parameter_id,
  create_property_id,
  create_import_id,
  extract_return_type,
  extract_parameter_type,
  extract_jsdoc_type,
  extract_import_path,
  extract_require_path,
  is_default_import,
  is_namespace_import,
  extract_extends,
  detect_callback_context,
  detect_function_collection,
} from "./symbol_factories.javascript";

describe("JavaScript Symbol Factory Exports", () => {
  it("should export create_class_id", () => {
    expect(typeof create_class_id).toBe("function");
  });

  it("should export create_method_id", () => {
    expect(typeof create_method_id).toBe("function");
  });

  it("should export create_function_id", () => {
    expect(typeof create_function_id).toBe("function");
  });

  it("should export create_variable_id", () => {
    expect(typeof create_variable_id).toBe("function");
  });

  it("should export create_parameter_id", () => {
    expect(typeof create_parameter_id).toBe("function");
  });

  it("should export create_property_id", () => {
    expect(typeof create_property_id).toBe("function");
  });

  it("should export create_import_id", () => {
    expect(typeof create_import_id).toBe("function");
  });
});

describe("JavaScript Type Extraction Exports", () => {
  it("should export extract_return_type", () => {
    expect(typeof extract_return_type).toBe("function");
  });

  it("should export extract_parameter_type", () => {
    expect(typeof extract_parameter_type).toBe("function");
  });

  it("should export extract_jsdoc_type", () => {
    expect(typeof extract_jsdoc_type).toBe("function");
  });
});

describe("JavaScript Import Utilities", () => {
  it("should export extract_import_path", () => {
    expect(typeof extract_import_path).toBe("function");
  });

  it("should export extract_require_path", () => {
    expect(typeof extract_require_path).toBe("function");
  });

  it("should export is_default_import", () => {
    expect(typeof is_default_import).toBe("function");
  });

  it("should export is_namespace_import", () => {
    expect(typeof is_namespace_import).toBe("function");
  });
});

describe("JavaScript Analysis Functions", () => {
  it("should export extract_extends", () => {
    expect(typeof extract_extends).toBe("function");
  });

  it("should export detect_callback_context", () => {
    expect(typeof detect_callback_context).toBe("function");
  });

  it("should export detect_function_collection", () => {
    expect(typeof detect_function_collection).toBe("function");
  });
});

describe("extract_jsdoc_type", () => {
  it("should extract type from @type annotation", () => {
    const comment = "/** @type {string} */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBe("string");
  });

  it("should return undefined for comments without type", () => {
    const comment = "/** Just a comment */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBeUndefined();
  });
});
