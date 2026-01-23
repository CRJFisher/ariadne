/**
 * Tests for Rust symbol factories
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
// @ts-expect-error - tree-sitter-rust types
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
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
import { anonymous_function_symbol } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";

// Helper to parse Rust code
function parse_rust(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Rust);
  const tree = parser.parse(code);
  return tree.rootNode;
}

// Helper to find function name node
function find_function_name_node(root: SyntaxNode, fn_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "function_item") {
      const name_node = node.childForFieldName?.("name");
      if (name_node && name_node.text === fn_name) {
        return name_node;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }
  return visit(root);
}

// Helper to find struct name node
function find_struct_name_node(root: SyntaxNode, struct_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "struct_item") {
      const name_node = node.childForFieldName?.("name");
      if (name_node && name_node.text === struct_name) {
        return name_node;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }
  return visit(root);
}

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

describe("has_pub_modifier", () => {
  it("should detect pub modifier on functions", () => {
    const code = "pub fn public_function() {}";
    const root = parse_rust(code);
    const fn_node = find_function_name_node(root, "public_function");
    expect(fn_node).not.toBeNull();
    expect(has_pub_modifier(fn_node!)).toBe(true);
  });

  it("should return false for private functions", () => {
    const code = "fn private_function() {}";
    const root = parse_rust(code);
    const fn_node = find_function_name_node(root, "private_function");
    expect(fn_node).not.toBeNull();
    expect(has_pub_modifier(fn_node!)).toBe(false);
  });

  it("should detect pub(crate) modifier", () => {
    const code = "pub(crate) fn crate_visible_function() {}";
    const root = parse_rust(code);
    const fn_node = find_function_name_node(root, "crate_visible_function");
    expect(fn_node).not.toBeNull();
    expect(has_pub_modifier(fn_node!)).toBe(true);
  });

  it("should detect pub(super) modifier", () => {
    const code = "pub(super) fn super_visible_function() {}";
    const root = parse_rust(code);
    const fn_node = find_function_name_node(root, "super_visible_function");
    expect(fn_node).not.toBeNull();
    expect(has_pub_modifier(fn_node!)).toBe(true);
  });

  it("should detect pub modifier on structs", () => {
    const code = "pub struct PublicStruct { field: i32 }";
    const root = parse_rust(code);
    const struct_node = find_struct_name_node(root, "PublicStruct");
    expect(struct_node).not.toBeNull();
    expect(has_pub_modifier(struct_node!)).toBe(true);
  });

  it("should return false for private structs", () => {
    const code = "struct PrivateStruct { field: i32 }";
    const root = parse_rust(code);
    const struct_node = find_struct_name_node(root, "PrivateStruct");
    expect(struct_node).not.toBeNull();
    expect(has_pub_modifier(struct_node!)).toBe(false);
  });

  it("should detect pub async fn", () => {
    const code = "pub async fn async_public_fn() {}";
    const root = parse_rust(code);
    const fn_node = find_function_name_node(root, "async_public_fn");
    expect(fn_node).not.toBeNull();
    expect(has_pub_modifier(fn_node!)).toBe(true);
  });
});

// Helper to find the closure_expression node
function find_closure(root: SyntaxNode): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "closure_expression") {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }
  return visit(root);
}

// Helper to find a parameter inside a closure
function find_closure_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  const closure = find_closure(root);
  if (!closure) return null;

  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "identifier" && node.text === param_name) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }

  // Look for parameters in the closure's parameters field
  const params = closure.childForFieldName?.("parameters");
  if (params) {
    return visit(params);
  }
  return null;
}

describe("find_containing_callable with closure expressions", () => {
  const file_path = "/test.rs" as FilePath;

  it("should return matching SymbolId for closure parameters", () => {
    const code = "let f = |x| x * 2;";
    const root = parse_rust(code);

    // Find the parameter 'x' node
    const param_node = find_closure_param(root, "x");
    expect(param_node).not.toBeNull();

    // Find the closure node
    const closure_node = find_closure(root);
    expect(closure_node).not.toBeNull();

    // Create capture node for parameter
    const capture = {
      node: param_node!,
      text: "x",
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    // Get the callable ID
    const callable_id = find_containing_callable(capture);

    // Expected: anonymous_function_symbol with closure's location
    const expected_id = anonymous_function_symbol(node_to_location(closure_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });

  it("should return matching SymbolId for iterator closure parameters", () => {
    const code = "let result = items.iter().map(|item| item * 2).collect();";
    const root = parse_rust(code);

    // Find the parameter 'item' node
    const param_node = find_closure_param(root, "item");
    expect(param_node).not.toBeNull();

    // Find the closure node
    const closure_node = find_closure(root);
    expect(closure_node).not.toBeNull();

    // Create capture node for parameter
    const capture = {
      node: param_node!,
      text: "item",
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    // Get the callable ID
    const callable_id = find_containing_callable(capture);

    // Expected: anonymous_function_symbol with closure's location
    const expected_id = anonymous_function_symbol(node_to_location(closure_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });
});
