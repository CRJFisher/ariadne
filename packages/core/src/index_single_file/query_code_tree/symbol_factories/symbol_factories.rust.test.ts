/**
 * Tests for Rust symbol factories
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
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
  detect_callback_context,
  store_documentation,
  consume_documentation,
  reset_documentation_state,
} from "./symbol_factories.rust";
import {
  anonymous_function_symbol,
  class_symbol,
  function_symbol,
  method_symbol,
  property_symbol,
  variable_symbol,
  constant_symbol,
  parameter_symbol,
  interface_symbol,
  enum_symbol,
  type_alias_symbol,
  module_symbol,
} from "@ariadnejs/types";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import { node_to_location } from "../../node_to_location";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "../../../index_single_file";

// ============================================================================
// Helpers
// ============================================================================

const file_path = "/test.rs" as FilePath;

function parse_rust(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Rust);
  const tree = parser.parse(code);
  return tree.rootNode;
}

function find_node_by_type(root: SyntaxNode, type: string): SyntaxNode | null {
  if (root.type === type) return root;
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child) {
      const result = find_node_by_type(child, type);
      if (result) return result;
    }
  }
  return null;
}

function find_all_nodes_by_type(root: SyntaxNode, type: string): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  function visit(node: SyntaxNode) {
    if (node.type === type) results.push(node);
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) visit(child);
    }
  }
  visit(root);
  return results;
}

function find_named_child(root: SyntaxNode, type: string, name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === type) {
      const name_node = node.childForFieldName?.("name");
      if (name_node && name_node.text === name) {
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

function find_function_name_node(root: SyntaxNode, fn_name: string): SyntaxNode | null {
  return find_named_child(root, "function_item", fn_name);
}

function find_struct_name_node(root: SyntaxNode, struct_name: string): SyntaxNode | null {
  return find_named_child(root, "struct_item", struct_name);
}

function find_trait_name_node(root: SyntaxNode, trait_name: string): SyntaxNode | null {
  return find_named_child(root, "trait_item", trait_name);
}

function find_enum_name_node(root: SyntaxNode, enum_name: string): SyntaxNode | null {
  return find_named_child(root, "enum_item", enum_name);
}

function find_closure(root: SyntaxNode): SyntaxNode | null {
  return find_node_by_type(root, "closure_expression");
}

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

  const params = closure.childForFieldName?.("parameters");
  if (params) {
    return visit(params);
  }
  return null;
}

function make_capture(node: SyntaxNode, overrides: Partial<CaptureNode> = {}): CaptureNode {
  return {
    node,
    text: (overrides.text ?? node.text) as SymbolName,
    name: overrides.name ?? "definition.struct",
    category: overrides.category ?? SemanticCategory.DEFINITION,
    entity: overrides.entity ?? SemanticEntity.CLASS,
    location: overrides.location ?? {
      file_path,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column + 1,
    },
  };
}

// ============================================================================
// create_*_id tests
// ============================================================================

describe("create_struct_id", () => {
  it("returns a class SymbolId using parent struct_item location", () => {
    const code = "struct Point { x: i32 }";
    const root = parse_rust(code);
    const name_node = find_struct_name_node(root, "Point")!;
    expect(name_node).not.toBeNull();

    const struct_item = name_node.parent!;
    const capture = make_capture(name_node);
    const id = create_struct_id(capture);

    const expected = class_symbol("Point" as SymbolName, {
      file_path,
      start_line: struct_item.startPosition.row + 1,
      start_column: struct_item.startPosition.column + 1,
      end_line: struct_item.endPosition.row + 1,
      end_column: struct_item.endPosition.column,
    });
    expect(id).toBe(expected);
  });

  it("starts with 'class:'", () => {
    const code = "struct Foo {}";
    const root = parse_rust(code);
    const name_node = find_struct_name_node(root, "Foo")!;
    const capture = make_capture(name_node);
    const id = create_struct_id(capture);
    expect(id).toMatch(/^class:/);
  });
});

describe("create_enum_id", () => {
  it("returns an enum SymbolId using the capture location", () => {
    const code = "enum Color { Red }";
    const root = parse_rust(code);
    const name_node = find_enum_name_node(root, "Color")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, {
      name: "definition.enum",
      entity: SemanticEntity.ENUM,
    });
    const id = create_enum_id(capture);

    const expected = enum_symbol("Color" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^enum:/);
  });
});

describe("create_trait_id", () => {
  it("returns an interface SymbolId using parent trait_item location", () => {
    const code = "trait Display { fn fmt(&self); }";
    const root = parse_rust(code);
    const name_node = find_trait_name_node(root, "Display")!;
    expect(name_node).not.toBeNull();

    const trait_item = name_node.parent!;
    const capture = make_capture(name_node, {
      name: "definition.interface",
      entity: SemanticEntity.INTERFACE,
    });
    const id = create_trait_id(capture);

    const expected = interface_symbol("Display" as SymbolName, {
      file_path,
      start_line: trait_item.startPosition.row + 1,
      start_column: trait_item.startPosition.column + 1,
      end_line: trait_item.endPosition.row + 1,
      end_column: trait_item.endPosition.column,
    });
    expect(id).toBe(expected);
    expect(id).toMatch(/^interface:/);
  });
});

describe("create_function_id", () => {
  it("returns a function SymbolId using parent function_item location", () => {
    const code = "fn add(a: i32, b: i32) -> i32 { a + b }";
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "add")!;
    expect(name_node).not.toBeNull();

    const function_item = name_node.parent!;
    const capture = make_capture(name_node, {
      name: "definition.function",
      entity: SemanticEntity.FUNCTION,
    });
    const id = create_function_id(capture);

    const expected = function_symbol("add" as SymbolName, {
      file_path,
      start_line: function_item.startPosition.row + 1,
      start_column: function_item.startPosition.column + 1,
      end_line: function_item.endPosition.row + 1,
      end_column: function_item.endPosition.column,
    });
    expect(id).toBe(expected);
    expect(id).toMatch(/^function:/);
  });
});

describe("create_method_id", () => {
  it("returns a method SymbolId using parent function_item location", () => {
    const code = `
impl Point {
    fn distance(&self) -> f64 { 0.0 }
}`;
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "distance")!;
    expect(name_node).not.toBeNull();

    const function_item = name_node.parent!;
    const capture = make_capture(name_node, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });
    const id = create_method_id(capture);

    const expected = method_symbol("distance" as SymbolName, {
      file_path,
      start_line: function_item.startPosition.row + 1,
      start_column: function_item.startPosition.column + 1,
      end_line: function_item.endPosition.row + 1,
      end_column: function_item.endPosition.column,
    });
    expect(id).toBe(expected);
    expect(id).toMatch(/^method:/);
  });
});

describe("create_field_id", () => {
  it("returns a property SymbolId using the capture location", () => {
    const code = "struct Foo { bar: i32 }";
    const root = parse_rust(code);

    // Find the field_declaration, then the field name node
    const field_decl = find_node_by_type(root, "field_declaration")!;
    expect(field_decl).not.toBeNull();
    const name_node = field_decl.childForFieldName?.("name")!;
    expect(name_node).not.toBeNull();
    expect(name_node.text).toBe("bar");

    const capture = make_capture(name_node, {
      name: "definition.field",
      entity: SemanticEntity.FIELD,
    });
    const id = create_field_id(capture);

    const expected = property_symbol("bar" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^property:/);
  });
});

describe("create_variable_id", () => {
  it("returns a variable SymbolId", () => {
    const code = "fn main() { let x = 42; }";
    const root = parse_rust(code);

    // Find the identifier "x" inside let_declaration
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName?.("pattern")!;
    expect(pattern.text).toBe("x");

    const capture = make_capture(pattern, {
      name: "definition.variable",
      entity: SemanticEntity.VARIABLE,
    });
    const id = create_variable_id(capture);

    const expected = variable_symbol("x" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^variable:/);
  });
});

describe("create_constant_id", () => {
  it("returns a constant SymbolId", () => {
    const code = "const MAX: i32 = 100;";
    const root = parse_rust(code);

    const const_item = find_node_by_type(root, "const_item")!;
    const name_node = const_item.childForFieldName?.("name")!;
    expect(name_node.text).toBe("MAX");

    const capture = make_capture(name_node, {
      name: "definition.constant",
      entity: SemanticEntity.CONSTANT,
    });
    const id = create_constant_id(capture);

    const expected = constant_symbol("MAX" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^constant:/);
  });
});

describe("create_parameter_id", () => {
  it("returns a parameter SymbolId", () => {
    const code = "fn greet(name: &str) {}";
    const root = parse_rust(code);

    // Find parameter node
    const param = find_node_by_type(root, "parameter")!;
    const pattern = param.childForFieldName?.("pattern")!;
    expect(pattern.text).toBe("name");

    const capture = make_capture(pattern, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });
    const id = create_parameter_id(capture);

    const expected = parameter_symbol("name" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^parameter:/);
  });
});

describe("create_module_id", () => {
  it("returns a module SymbolId using location only", () => {
    const code = "mod utils {}";
    const root = parse_rust(code);

    const mod_item = find_node_by_type(root, "mod_item")!;
    const name_node = mod_item.childForFieldName?.("name")!;
    expect(name_node.text).toBe("utils");

    const capture = make_capture(name_node, {
      name: "definition.module",
      entity: SemanticEntity.MODULE,
    });
    const id = create_module_id(capture);

    const expected = module_symbol(capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^module:/);
    expect(id).toContain("<module>");
  });
});

describe("create_type_alias_id", () => {
  it("returns a type_alias SymbolId", () => {
    const code = "type Kilometers = i32;";
    const root = parse_rust(code);

    const type_item = find_node_by_type(root, "type_item")!;
    const name_node = type_item.childForFieldName?.("name")!;
    expect(name_node.text).toBe("Kilometers");

    const capture = make_capture(name_node, {
      name: "definition.type_alias",
      entity: SemanticEntity.TYPE_ALIAS,
    });
    const id = create_type_alias_id(capture);

    const expected = type_alias_symbol("Kilometers" as SymbolName, capture.location);
    expect(id).toBe(expected);
    expect(id).toMatch(/^type_alias:/);
  });
});

// ============================================================================
// has_pub_modifier
// ============================================================================

describe("has_pub_modifier", () => {
  it("detects pub modifier on functions", () => {
    const root = parse_rust("pub fn public_function() {}");
    const fn_node = find_function_name_node(root, "public_function")!;
    expect(has_pub_modifier(fn_node)).toBe(true);
  });

  it("returns false for private functions", () => {
    const root = parse_rust("fn private_function() {}");
    const fn_node = find_function_name_node(root, "private_function")!;
    expect(has_pub_modifier(fn_node)).toBe(false);
  });

  it("detects pub(crate) modifier", () => {
    const root = parse_rust("pub(crate) fn crate_visible() {}");
    const fn_node = find_function_name_node(root, "crate_visible")!;
    expect(has_pub_modifier(fn_node)).toBe(true);
  });

  it("detects pub(super) modifier", () => {
    const root = parse_rust("pub(super) fn super_visible() {}");
    const fn_node = find_function_name_node(root, "super_visible")!;
    expect(has_pub_modifier(fn_node)).toBe(true);
  });

  it("detects pub modifier on structs", () => {
    const root = parse_rust("pub struct PublicStruct { field: i32 }");
    const struct_node = find_struct_name_node(root, "PublicStruct")!;
    expect(has_pub_modifier(struct_node)).toBe(true);
  });

  it("returns false for private structs", () => {
    const root = parse_rust("struct PrivateStruct { field: i32 }");
    const struct_node = find_struct_name_node(root, "PrivateStruct")!;
    expect(has_pub_modifier(struct_node)).toBe(false);
  });

  it("detects pub async fn", () => {
    const root = parse_rust("pub async fn async_public_fn() {}");
    const fn_node = find_function_name_node(root, "async_public_fn")!;
    expect(has_pub_modifier(fn_node)).toBe(true);
  });
});

// ============================================================================
// extract_export_info
// ============================================================================

describe("extract_export_info", () => {
  it("returns is_exported true for pub items", () => {
    const root = parse_rust("pub fn exported() {}");
    const fn_node = find_function_name_node(root, "exported")!;
    const info = extract_export_info(fn_node);
    expect(info.is_exported).toBe(true);
    expect(info.export).toBeUndefined();
  });

  it("returns is_exported false for non-pub items", () => {
    const root = parse_rust("fn private() {}");
    const fn_node = find_function_name_node(root, "private")!;
    const info = extract_export_info(fn_node);
    expect(info.is_exported).toBe(false);
    expect(info.export).toBeUndefined();
  });

  it("returns is_exported true for pub struct", () => {
    const root = parse_rust("pub struct Visible {}");
    const struct_node = find_struct_name_node(root, "Visible")!;
    const info = extract_export_info(struct_node);
    expect(info.is_exported).toBe(true);
  });
});

// ============================================================================
// extract_generic_parameters
// ============================================================================

describe("extract_generic_parameters", () => {
  it("extracts type parameters from a generic function", () => {
    const code = "fn foo<T, U>(x: T, y: U) {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const params = extract_generic_parameters(fn_item);
    expect(params).toEqual(["T", "U"]);
  });

  it("returns empty array for non-generic function", () => {
    const code = "fn bar(x: i32) {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const params = extract_generic_parameters(fn_item);
    expect(params).toEqual([]);
  });

  it("extracts lifetime parameters", () => {
    const code = "fn borrow<'a>(x: &'a str) {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const params = extract_generic_parameters(fn_item);
    expect(params).toEqual(["'a"]);
  });

  it("extracts from generic struct", () => {
    const code = "struct Container<T> { value: T }";
    const root = parse_rust(code);
    const struct_item = find_node_by_type(root, "struct_item")!;
    const params = extract_generic_parameters(struct_item);
    expect(params).toEqual(["T"]);
  });
});

// ============================================================================
// extract_impl_trait
// ============================================================================

describe("extract_impl_trait", () => {
  it("extracts trait name from impl Trait for Type", () => {
    const code = "impl Display for Foo { fn fmt(&self) {} }";
    const root = parse_rust(code);
    const impl_item = find_node_by_type(root, "impl_item")!;
    const trait_name = extract_impl_trait(impl_item);
    expect(trait_name).toBe("Display");
  });

  it("returns undefined for inherent impl", () => {
    const code = "impl Foo { fn new() {} }";
    const root = parse_rust(code);
    const impl_item = find_node_by_type(root, "impl_item")!;
    const trait_name = extract_impl_trait(impl_item);
    expect(trait_name).toBeUndefined();
  });

  it("returns undefined for non-impl nodes", () => {
    const code = "fn foo() {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const trait_name = extract_impl_trait(fn_item);
    expect(trait_name).toBeUndefined();
  });
});

// ============================================================================
// extract_impl_type
// ============================================================================

describe("extract_impl_type", () => {
  it("extracts type name from simple impl block", () => {
    const code = "impl Foo { fn new() {} }";
    const root = parse_rust(code);
    const impl_item = find_node_by_type(root, "impl_item")!;
    const type_name = extract_impl_type(impl_item);
    expect(type_name).toBe("Foo");
  });

  it("extracts base type name from generic impl", () => {
    const code = "impl<T> Bar<T> { fn new() {} }";
    const root = parse_rust(code);
    const impl_item = find_node_by_type(root, "impl_item")!;
    const type_name = extract_impl_type(impl_item);
    expect(type_name).toBe("Bar");
  });

  it("extracts type from trait impl", () => {
    const code = "impl Display for MyType { fn fmt(&self) {} }";
    const root = parse_rust(code);
    const impl_item = find_node_by_type(root, "impl_item")!;
    const type_name = extract_impl_type(impl_item);
    expect(type_name).toBe("MyType");
  });

  it("returns undefined for non-impl nodes", () => {
    const code = "fn foo() {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const type_name = extract_impl_type(fn_item);
    expect(type_name).toBeUndefined();
  });
});

// ============================================================================
// extract_return_type
// ============================================================================

describe("extract_return_type", () => {
  it("extracts simple return type", () => {
    const code = "fn foo() -> i32 { 42 }";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const return_type = extract_return_type(fn_item);
    expect(return_type).toBe("i32");
  });

  it("returns undefined when no return type", () => {
    const code = "fn bar() {}";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const return_type = extract_return_type(fn_item);
    expect(return_type).toBeUndefined();
  });

  it("extracts complex return type", () => {
    const code = "fn baz() -> Result<String, Error> { Ok(String::new()) }";
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    const return_type = extract_return_type(fn_item);
    expect(return_type).toBe("Result<String, Error>");
  });
});

// ============================================================================
// extract_parameter_type
// ============================================================================

describe("extract_parameter_type", () => {
  it("extracts parameter type from a typed parameter", () => {
    const code = "fn foo(x: i32) {}";
    const root = parse_rust(code);
    const param = find_node_by_type(root, "parameter")!;
    const param_type = extract_parameter_type(param);
    expect(param_type).toBe("i32");
  });

  it("extracts reference parameter type", () => {
    const code = "fn foo(s: &str) {}";
    const root = parse_rust(code);
    const param = find_node_by_type(root, "parameter")!;
    const param_type = extract_parameter_type(param);
    expect(param_type).toBe("&str");
  });
});

// ============================================================================
// is_self_parameter
// ============================================================================

describe("is_self_parameter", () => {
  it("returns true for &self parameter", () => {
    const code = `
impl Foo {
    fn method(&self) {}
}`;
    const root = parse_rust(code);
    const self_param = find_node_by_type(root, "self_parameter")!;
    expect(self_param).not.toBeNull();
    expect(is_self_parameter(self_param)).toBe(true);
  });

  it("returns true for owned self parameter", () => {
    const code = `
impl Foo {
    fn consume(self) {}
}`;
    const root = parse_rust(code);
    const self_param = find_node_by_type(root, "self_parameter")!;
    expect(self_param).not.toBeNull();
    expect(is_self_parameter(self_param)).toBe(true);
  });

  it("returns true for &mut self parameter", () => {
    const code = `
impl Foo {
    fn mutate(&mut self) {}
}`;
    const root = parse_rust(code);
    const self_param = find_node_by_type(root, "self_parameter")!;
    expect(self_param).not.toBeNull();
    expect(is_self_parameter(self_param)).toBe(true);
  });

  it("returns false for regular parameter", () => {
    const code = "fn foo(x: i32) {}";
    const root = parse_rust(code);
    const param = find_node_by_type(root, "parameter")!;
    expect(is_self_parameter(param)).toBe(false);
  });

  it("returns false for parameter named something else", () => {
    const code = "fn foo(name: String) {}";
    const root = parse_rust(code);
    const param = find_node_by_type(root, "parameter")!;
    expect(is_self_parameter(param)).toBe(false);
  });
});

// ============================================================================
// find_containing_impl
// ============================================================================

describe("find_containing_impl", () => {
  it("finds inherent impl for a method", () => {
    const code = `
impl Point {
    fn distance(&self) -> f64 { 0.0 }
}`;
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "distance")!;
    const capture = make_capture(name_node, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_impl(capture);
    expect(result).toBeDefined();
    expect(result!.struct_name).toBe("Point");
    expect(result!.trait_name).toBeUndefined();
  });

  it("finds trait impl with both struct and trait name", () => {
    const code = `
impl Display for Foo {
    fn fmt(&self) {}
}`;
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "fmt")!;
    const capture = make_capture(name_node, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_impl(capture);
    expect(result).toBeDefined();
    expect(result!.struct_name).toBe("Foo");
    expect(result!.trait_name).toBe("Display");
  });

  it("returns undefined for standalone function", () => {
    const code = "fn standalone() {}";
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "standalone")!;
    const capture = make_capture(name_node, {
      name: "definition.function",
      entity: SemanticEntity.FUNCTION,
    });

    const result = find_containing_impl(capture);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// find_containing_struct
// ============================================================================

describe("find_containing_struct", () => {
  it("finds the containing struct for a field", () => {
    const code = "struct Point { x: i32, y: i32 }";
    const root = parse_rust(code);

    const field_decl = find_node_by_type(root, "field_declaration")!;
    const field_name = field_decl.childForFieldName?.("name")!;
    expect(field_name.text).toBe("x");

    const capture = make_capture(field_name, {
      name: "definition.field",
      entity: SemanticEntity.FIELD,
    });

    const result = find_containing_struct(capture);
    expect(result).toBeDefined();

    // The result should be a class symbol using struct_item's location
    const struct_item = find_node_by_type(root, "struct_item")!;
    const expected = class_symbol("Point" as SymbolName, {
      file_path,
      start_line: struct_item.startPosition.row + 1,
      start_column: struct_item.startPosition.column + 1,
      end_line: struct_item.endPosition.row + 1,
      end_column: struct_item.endPosition.column,
    });
    expect(result).toBe(expected);
  });

  it("returns undefined for nodes not inside a struct", () => {
    const code = "fn foo() {}";
    const root = parse_rust(code);
    const fn_name = find_function_name_node(root, "foo")!;
    const capture = make_capture(fn_name, {
      name: "definition.function",
      entity: SemanticEntity.FUNCTION,
    });
    const result = find_containing_struct(capture);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// find_containing_trait
// ============================================================================

describe("find_containing_trait", () => {
  it("finds the containing trait for a method", () => {
    const code = `
trait Drawable {
    fn draw(&self);
}`;
    const root = parse_rust(code);
    // function_signature_item is used for trait method declarations
    const sig = find_node_by_type(root, "function_signature_item");
    // If tree-sitter-rust uses function_signature_item, look for the name there
    // Otherwise find the name "draw" in any function-like node
    let name_node: SyntaxNode | null = null;
    if (sig) {
      name_node = sig.childForFieldName?.("name") ?? null;
    }
    if (!name_node) {
      // Fallback: search for the identifier "draw" within the trait
      name_node = find_function_name_node(root, "draw");
    }
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node!, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_trait(capture);
    expect(result).toBe("Drawable");
  });

  it("returns undefined for method outside of trait", () => {
    const code = `
impl Foo {
    fn bar(&self) {}
}`;
    const root = parse_rust(code);
    const name_node = find_function_name_node(root, "bar")!;
    const capture = make_capture(name_node, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_trait(capture);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// extract_enum_variants
// ============================================================================

describe("extract_enum_variants", () => {
  it("extracts variant names from a simple enum", () => {
    const code = "enum Color { Red, Green, Blue }";
    const root = parse_rust(code);
    const enum_item = find_node_by_type(root, "enum_item")!;
    const variants = extract_enum_variants(enum_item);
    expect(variants).toEqual(["Red", "Green", "Blue"]);
  });

  it("extracts variants from enum with tuple variants", () => {
    const code = "enum Shape { Circle(f64), Rectangle(f64, f64) }";
    const root = parse_rust(code);
    const enum_item = find_node_by_type(root, "enum_item")!;
    const variants = extract_enum_variants(enum_item);
    expect(variants).toEqual(["Circle", "Rectangle"]);
  });

  it("returns empty array for non-enum node", () => {
    const code = "struct Foo {}";
    const root = parse_rust(code);
    const struct_item = find_node_by_type(root, "struct_item")!;
    const variants = extract_enum_variants(struct_item);
    expect(variants).toEqual([]);
  });
});

// ============================================================================
// is_associated_function
// ============================================================================

describe("is_associated_function", () => {
  it("returns true for function without self parameter", () => {
    const code = `
impl Foo {
    fn new() -> Foo { Foo {} }
}`;
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    expect(is_associated_function(fn_item)).toBe(true);
  });

  it("returns false for method with &self", () => {
    const code = `
impl Foo {
    fn bar(&self) {}
}`;
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    expect(is_associated_function(fn_item)).toBe(false);
  });

  it("returns false for method with &mut self", () => {
    const code = `
impl Foo {
    fn mutate(&mut self) {}
}`;
    const root = parse_rust(code);
    const fn_item = find_node_by_type(root, "function_item")!;
    expect(is_associated_function(fn_item)).toBe(false);
  });
});

// ============================================================================
// find_containing_callable
// ============================================================================

describe("find_containing_callable", () => {
  it("returns function SymbolId for parameter inside standalone function", () => {
    const code = "fn process(value: i32) {}";
    const root = parse_rust(code);

    const param = find_node_by_type(root, "parameter")!;
    const pattern = param.childForFieldName?.("pattern")!;
    expect(pattern.text).toBe("value");

    const capture = make_capture(pattern, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const callable_id = find_containing_callable(capture);

    const fn_item = find_node_by_type(root, "function_item")!;
    const expected = function_symbol("process" as SymbolName, {
      file_path,
      start_line: fn_item.startPosition.row + 1,
      start_column: fn_item.startPosition.column + 1,
      end_line: fn_item.endPosition.row + 1,
      end_column: fn_item.endPosition.column,
    });
    expect(callable_id).toBe(expected);
  });

  it("returns method SymbolId for parameter inside impl method", () => {
    const code = `
impl Foo {
    fn bar(&self, x: i32) {}
}`;
    const root = parse_rust(code);

    // Find the regular parameter (not self_parameter)
    const params = find_all_nodes_by_type(root, "parameter");
    expect(params.length).toBeGreaterThan(0);
    const param = params[0]!;
    const pattern = param.childForFieldName?.("pattern")!;
    expect(pattern.text).toBe("x");

    const capture = make_capture(pattern, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const callable_id = find_containing_callable(capture);

    const fn_item = find_node_by_type(root, "function_item")!;
    const fn_name = fn_item.childForFieldName?.("name")!;
    const expected = method_symbol(fn_name.text as SymbolName, {
      file_path,
      start_line: fn_item.startPosition.row + 1,
      start_column: fn_item.startPosition.column + 1,
      end_line: fn_item.endPosition.row + 1,
      end_column: fn_item.endPosition.column,
    });
    expect(callable_id).toBe(expected);
  });

  it("returns anonymous_function_symbol for closure parameter", () => {
    const code = "let f = |x| x * 2;";
    const root = parse_rust(code);

    const param_node = find_closure_param(root, "x")!;
    expect(param_node).not.toBeNull();
    const closure_node = find_closure(root)!;
    expect(closure_node).not.toBeNull();

    const capture = make_capture(param_node, {
      text: "x" as SymbolName,
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const callable_id = find_containing_callable(capture);
    const expected_id = anonymous_function_symbol(node_to_location(closure_node, file_path));
    expect(callable_id).toBe(expected_id);
  });

  it("returns anonymous_function_symbol for iterator closure parameter", () => {
    const code = "let result = items.iter().map(|item| item * 2).collect();";
    const root = parse_rust(code);

    const param_node = find_closure_param(root, "item")!;
    expect(param_node).not.toBeNull();
    const closure_node = find_closure(root)!;
    expect(closure_node).not.toBeNull();

    const capture = make_capture(param_node, {
      text: "item" as SymbolName,
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const callable_id = find_containing_callable(capture);
    const expected_id = anonymous_function_symbol(node_to_location(closure_node, file_path));
    expect(callable_id).toBe(expected_id);
  });
});

// ============================================================================
// detect_callback_context
// ============================================================================

describe("detect_callback_context", () => {
  it("detects closure as callback when passed to function call", () => {
    const code = "fn main() { process(|x| x + 1); }";
    const root = parse_rust(code);

    const closure = find_closure(root)!;
    expect(closure).not.toBeNull();

    const result = detect_callback_context(closure, file_path);
    expect(result.is_callback).toBe(true);
    expect(result.receiver_location).not.toBeNull();
    expect(result.receiver_location!.file_path).toBe(file_path);
  });

  it("returns is_callback false for standalone closure", () => {
    const code = "fn main() { let f = |x| x + 1; }";
    const root = parse_rust(code);

    const closure = find_closure(root)!;
    expect(closure).not.toBeNull();

    const result = detect_callback_context(closure, file_path);
    expect(result.is_callback).toBe(false);
    expect(result.receiver_location).toBeNull();
  });

  it("detects closure in method chain as callback", () => {
    const code = "fn main() { items.iter().map(|x| x * 2).collect::<Vec<_>>(); }";
    const root = parse_rust(code);

    const closure = find_closure(root)!;
    expect(closure).not.toBeNull();

    const result = detect_callback_context(closure, file_path);
    expect(result.is_callback).toBe(true);
  });
});

// ============================================================================
// Documentation state management
// ============================================================================

describe("documentation state", () => {
  beforeEach(() => {
    reset_documentation_state();
  });

  it("stores and consumes documentation for adjacent definition", () => {
    store_documentation("/// Does something", 5);
    const doc = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// Does something");
  });

  it("concatenates consecutive comment lines", () => {
    store_documentation("/// Line 1", 5);
    store_documentation("/// Line 2", 6);
    const doc = consume_documentation({
      file_path,
      start_line: 7,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// Line 1\n/// Line 2");
  });

  it("returns undefined when no documentation matches", () => {
    store_documentation("/// Far away", 1);
    const doc = consume_documentation({
      file_path,
      start_line: 10,
      start_column: 1,
      end_line: 15,
      end_column: 1,
    });
    expect(doc).toBeUndefined();
  });

  it("consumes documentation only once", () => {
    store_documentation("/// Single use", 5);
    const first = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(first).toBe("/// Single use");

    const second = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(second).toBeUndefined();
  });

  it("allows 1-line gap between doc and definition", () => {
    store_documentation("/// With gap", 5);
    // Definition starts at line 7 (gap at line 6)
    const doc = consume_documentation({
      file_path,
      start_line: 7,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBe("/// With gap");
  });

  it("reset clears all pending documentation", () => {
    store_documentation("/// Cleared", 5);
    reset_documentation_state();
    const doc = consume_documentation({
      file_path,
      start_line: 6,
      start_column: 1,
      end_line: 10,
      end_column: 1,
    });
    expect(doc).toBeUndefined();
  });
});

// ============================================================================
// detect_function_collection
// ============================================================================

describe("detect_function_collection", () => {
  it("detects array of function references", () => {
    const code = `fn main() {
    let handlers = [handler1, handler2, handler3];
}`;
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    expect(let_decl).not.toBeNull();

    const result = detect_function_collection(let_decl, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_references).toEqual(["handler1", "handler2", "handler3"]);
  });

  it("detects closures in array expression", () => {
    const code = `fn main() {
    let fns = [|x| x + 1, |x| x * 2];
}`;
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;

    const result = detect_function_collection(let_decl, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_functions.length).toBe(2);
  });

  it("detects vec! macro with function references", () => {
    const code = `fn main() {
    let handlers = vec![handler1, handler2];
}`;
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;

    const result = detect_function_collection(let_decl, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_references).toContain("handler1");
    expect(result!.stored_references).toContain("handler2");
  });

  it("returns null for non-collection declaration", () => {
    const code = `fn main() {
    let x = 42;
}`;
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;

    const result = detect_function_collection(let_decl, file_path);
    expect(result).toBeNull();
  });
});
