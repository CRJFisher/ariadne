/**
 * Tests for Python symbol factories
 */

import { describe, it, expect } from "vitest";
import {
  create_class_id,
  create_method_id,
  create_function_id,
  create_variable_id,
  create_parameter_id,
  create_property_id,
  create_enum_id,
  create_enum_member_id,
  create_protocol_id,
  create_type_alias_id,
  find_containing_class,
  find_containing_enum,
  find_containing_protocol,
  find_containing_callable,
  find_decorator_target,
  extract_return_type,
  extract_parameter_type,
  extract_property_type,
  extract_type_annotation,
  extract_default_value,
  extract_initial_value,
  extract_extends,
  extract_import_path,
  extract_export_info,
  is_async_function,
  determine_method_type,
  detect_callback_context,
  detect_function_collection,
} from "./symbol_factories.python";

describe("Python Symbol Factory Exports", () => {
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

  it("should export create_enum_id", () => {
    expect(typeof create_enum_id).toBe("function");
  });

  it("should export create_enum_member_id", () => {
    expect(typeof create_enum_member_id).toBe("function");
  });

  it("should export create_protocol_id", () => {
    expect(typeof create_protocol_id).toBe("function");
  });

  it("should export create_type_alias_id", () => {
    expect(typeof create_type_alias_id).toBe("function");
  });
});

describe("Python Container Finding Functions", () => {
  it("should export find_containing_class", () => {
    expect(typeof find_containing_class).toBe("function");
  });

  it("should export find_containing_enum", () => {
    expect(typeof find_containing_enum).toBe("function");
  });

  it("should export find_containing_protocol", () => {
    expect(typeof find_containing_protocol).toBe("function");
  });

  it("should export find_containing_callable", () => {
    expect(typeof find_containing_callable).toBe("function");
  });

  it("should export find_decorator_target", () => {
    expect(typeof find_decorator_target).toBe("function");
  });
});

describe("Python Type Extraction Functions", () => {
  it("should export extract_return_type", () => {
    expect(typeof extract_return_type).toBe("function");
  });

  it("should export extract_parameter_type", () => {
    expect(typeof extract_parameter_type).toBe("function");
  });

  it("should export extract_property_type", () => {
    expect(typeof extract_property_type).toBe("function");
  });

  it("should export extract_type_annotation", () => {
    expect(typeof extract_type_annotation).toBe("function");
  });
});

describe("Python Analysis Functions", () => {
  it("should export is_async_function", () => {
    expect(typeof is_async_function).toBe("function");
  });

  it("should export determine_method_type", () => {
    expect(typeof determine_method_type).toBe("function");
  });

  it("should export detect_callback_context", () => {
    expect(typeof detect_callback_context).toBe("function");
  });

  it("should export detect_function_collection", () => {
    expect(typeof detect_function_collection).toBe("function");
  });
});

describe("Python Import/Export Functions", () => {
  it("should export extract_import_path", () => {
    expect(typeof extract_import_path).toBe("function");
  });

  it("should export extract_export_info", () => {
    expect(typeof extract_export_info).toBe("function");
  });
});
