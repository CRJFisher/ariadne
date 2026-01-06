/**
 * Tests for Rust symbol factories
 */

import { describe, it, expect } from "vitest";
import {
  create_struct_id,
  create_enum_id,
  create_trait_id,
  create_function_id,
  create_method_id,
  create_field_id,
  create_variable_id,
  create_constant_id,
  create_parameter_id,
  create_module_id,
  create_type_alias_id,
  has_pub_modifier,
  extract_export_info,
  extract_generic_parameters,
  extract_impl_trait,
  extract_impl_type,
  extract_return_type,
  extract_parameter_type,
  is_self_parameter,
  find_containing_impl,
  find_containing_struct,
  find_containing_trait,
  extract_enum_variants,
  is_associated_function,
  find_containing_callable,
  detect_function_collection,
} from "./symbol_factories.rust";

describe("Rust Symbol Factory Exports", () => {
  it("should export create_struct_id", () => {
    expect(typeof create_struct_id).toBe("function");
  });

  it("should export create_enum_id", () => {
    expect(typeof create_enum_id).toBe("function");
  });

  it("should export create_trait_id", () => {
    expect(typeof create_trait_id).toBe("function");
  });

  it("should export create_function_id", () => {
    expect(typeof create_function_id).toBe("function");
  });

  it("should export create_method_id", () => {
    expect(typeof create_method_id).toBe("function");
  });

  it("should export create_field_id", () => {
    expect(typeof create_field_id).toBe("function");
  });

  it("should export create_variable_id", () => {
    expect(typeof create_variable_id).toBe("function");
  });

  it("should export create_constant_id", () => {
    expect(typeof create_constant_id).toBe("function");
  });

  it("should export create_parameter_id", () => {
    expect(typeof create_parameter_id).toBe("function");
  });

  it("should export create_module_id", () => {
    expect(typeof create_module_id).toBe("function");
  });

  it("should export create_type_alias_id", () => {
    expect(typeof create_type_alias_id).toBe("function");
  });
});

describe("Rust Visibility Functions", () => {
  it("should export has_pub_modifier", () => {
    expect(typeof has_pub_modifier).toBe("function");
  });

  it("should export extract_export_info", () => {
    expect(typeof extract_export_info).toBe("function");
  });
});

describe("Rust Type Functions", () => {
  it("should export extract_generic_parameters", () => {
    expect(typeof extract_generic_parameters).toBe("function");
  });

  it("should export extract_impl_trait", () => {
    expect(typeof extract_impl_trait).toBe("function");
  });

  it("should export extract_impl_type", () => {
    expect(typeof extract_impl_type).toBe("function");
  });

  it("should export extract_return_type", () => {
    expect(typeof extract_return_type).toBe("function");
  });

  it("should export extract_parameter_type", () => {
    expect(typeof extract_parameter_type).toBe("function");
  });
});

describe("Rust Analysis Functions", () => {
  it("should export is_self_parameter", () => {
    expect(typeof is_self_parameter).toBe("function");
  });

  it("should export find_containing_impl", () => {
    expect(typeof find_containing_impl).toBe("function");
  });

  it("should export find_containing_struct", () => {
    expect(typeof find_containing_struct).toBe("function");
  });

  it("should export find_containing_trait", () => {
    expect(typeof find_containing_trait).toBe("function");
  });

  it("should export extract_enum_variants", () => {
    expect(typeof extract_enum_variants).toBe("function");
  });

  it("should export is_associated_function", () => {
    expect(typeof is_associated_function).toBe("function");
  });

  it("should export find_containing_callable", () => {
    expect(typeof find_containing_callable).toBe("function");
  });

  it("should export detect_function_collection", () => {
    expect(typeof detect_function_collection).toBe("function");
  });
});
