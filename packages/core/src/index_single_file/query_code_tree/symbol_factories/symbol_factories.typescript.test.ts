/**
 * Tests for TypeScript symbol factories
 */

import { describe, it, expect } from "vitest";
import {
  create_interface_id,
  create_type_alias_id,
  create_enum_id,
  create_namespace_id,
  create_enum_member_id,
  create_method_signature_id,
  create_property_signature_id,
  create_class_id,
  create_method_id,
  create_parameter_id,
  create_property_id,
  extract_type_parameters,
  extract_interface_extends,
  extract_class_extends,
  extract_implements,
  extract_access_modifier,
  is_readonly_property,
  is_abstract_method,
  is_static_method,
  is_async_method,
  extract_return_type,
  extract_property_type,
  extract_parameter_type,
  extract_parameter_default_value,
} from "./symbol_factories.typescript";

describe("TypeScript Symbol Factory Exports", () => {
  it("should export create_interface_id", () => {
    expect(typeof create_interface_id).toBe("function");
  });

  it("should export create_type_alias_id", () => {
    expect(typeof create_type_alias_id).toBe("function");
  });

  it("should export create_enum_id", () => {
    expect(typeof create_enum_id).toBe("function");
  });

  it("should export create_namespace_id", () => {
    expect(typeof create_namespace_id).toBe("function");
  });

  it("should export create_enum_member_id", () => {
    expect(typeof create_enum_member_id).toBe("function");
  });

  it("should export create_method_signature_id", () => {
    expect(typeof create_method_signature_id).toBe("function");
  });

  it("should export create_property_signature_id", () => {
    expect(typeof create_property_signature_id).toBe("function");
  });

  it("should export create_class_id", () => {
    expect(typeof create_class_id).toBe("function");
  });

  it("should export create_method_id", () => {
    expect(typeof create_method_id).toBe("function");
  });

  it("should export create_parameter_id", () => {
    expect(typeof create_parameter_id).toBe("function");
  });

  it("should export create_property_id", () => {
    expect(typeof create_property_id).toBe("function");
  });
});

describe("TypeScript Type Extraction Exports", () => {
  it("should export extract_type_parameters", () => {
    expect(typeof extract_type_parameters).toBe("function");
  });

  it("should export extract_interface_extends", () => {
    expect(typeof extract_interface_extends).toBe("function");
  });

  it("should export extract_class_extends", () => {
    expect(typeof extract_class_extends).toBe("function");
  });

  it("should export extract_implements", () => {
    expect(typeof extract_implements).toBe("function");
  });

  it("should export extract_return_type", () => {
    expect(typeof extract_return_type).toBe("function");
  });

  it("should export extract_property_type", () => {
    expect(typeof extract_property_type).toBe("function");
  });

  it("should export extract_parameter_type", () => {
    expect(typeof extract_parameter_type).toBe("function");
  });

  it("should export extract_parameter_default_value", () => {
    expect(typeof extract_parameter_default_value).toBe("function");
  });
});

describe("TypeScript Modifier Functions", () => {
  it("should export extract_access_modifier", () => {
    expect(typeof extract_access_modifier).toBe("function");
  });

  it("should export is_readonly_property", () => {
    expect(typeof is_readonly_property).toBe("function");
  });

  it("should export is_abstract_method", () => {
    expect(typeof is_abstract_method).toBe("function");
  });

  it("should export is_static_method", () => {
    expect(typeof is_static_method).toBe("function");
  });

  it("should export is_async_method", () => {
    expect(typeof is_async_method).toBe("function");
  });
});
