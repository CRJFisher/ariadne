/**
 * Tests for TypeScript symbol factories
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
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
  find_containing_callable,
} from "./symbol_factories.typescript";
import { anonymous_function_symbol } from "@ariadnejs/types";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "../../../index_single_file";

// Helper to parse TypeScript code and find nodes
function parse_typescript(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  const tree = parser.parse(code);
  return tree.rootNode;
}

// Helper to find method name node (property_identifier) in a class
function find_method_name_node(root: SyntaxNode, method_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "method_definition") {
      for (const child of node.children) {
        if (child.type === "property_identifier" && child.text === method_name) {
          return child;
        }
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

// Helper to find property name node (property_identifier) in a class
function find_property_name_node(root: SyntaxNode, property_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "public_field_definition") {
      for (const child of node.children) {
        if (child.type === "property_identifier" && child.text === property_name) {
          return child;
        }
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

describe("extract_access_modifier", () => {
  it("should extract private modifier from methods", () => {
    const code = `
class MyClass {
  private getValue(): number {
    return 42;
  }
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "getValue");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("private");
  });

  it("should extract public modifier from methods", () => {
    const code = `
class MyClass {
  public initialize(): void {}
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "initialize");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("public");
  });

  it("should extract protected modifier from methods", () => {
    const code = `
class MyClass {
  protected helper(): void {}
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "helper");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("protected");
  });

  it("should return undefined for methods without access modifier", () => {
    const code = `
class MyClass {
  noModifier(): void {}
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "noModifier");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBeUndefined();
  });

  it("should handle async private methods", () => {
    const code = `
class MyClass {
  private async fetchData(): Promise<void> {}
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "fetchData");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("private");
  });

  it("should handle static public methods", () => {
    const code = `
class MyClass {
  public static getInstance(): MyClass { return new MyClass(); }
}`;
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "getInstance");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("public");
  });

  it("should extract private modifier from properties", () => {
    const code = `
class MyClass {
  private count: number = 0;
}`;
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "count");
    expect(prop_node).not.toBeNull();
    expect(extract_access_modifier(prop_node!)).toBe("private");
  });

  it("should extract public modifier from properties", () => {
    const code = `
class MyClass {
  public name: string = "";
}`;
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "name");
    expect(prop_node).not.toBeNull();
    expect(extract_access_modifier(prop_node!)).toBe("public");
  });

  it("should return undefined for properties without access modifier", () => {
    const code = `
class MyClass {
  value: number = 0;
}`;
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "value");
    expect(prop_node).not.toBeNull();
    expect(extract_access_modifier(prop_node!)).toBeUndefined();
  });

  it("should detect private # syntax for methods", () => {
    const code = `
class MyClass {
  #privateMethod(): void {}
}`;
    const root = parse_typescript(code);
    // For # syntax, the node type is private_property_identifier
    function find_private_method(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "private_property_identifier" && node.text === "#privateMethod") {
        return node;
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = find_private_method(child);
          if (result) return result;
        }
      }
      return null;
    }
    const method_node = find_private_method(root);
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("private");
  });

  it("should detect private # syntax for properties", () => {
    const code = `
class MyClass {
  #privateField = 0;
}`;
    const root = parse_typescript(code);
    function find_private_property(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "private_property_identifier" && node.text === "#privateField") {
        return node;
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = find_private_property(child);
          if (result) return result;
        }
      }
      return null;
    }
    const prop_node = find_private_property(root);
    expect(prop_node).not.toBeNull();
    expect(extract_access_modifier(prop_node!)).toBe("private");
  });
});

// Helper to find a parameter node inside an arrow function
function find_arrow_function_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "arrow_function") {
      // Look for the parameter inside the arrow function
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = find_identifier_in_params(child, param_name);
          if (result) return result;
        }
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

function find_identifier_in_params(node: SyntaxNode, param_name: string): SyntaxNode | null {
  if (node.type === "identifier" && node.text === param_name) {
    return node;
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = find_identifier_in_params(child, param_name);
      if (result) return result;
    }
  }
  return null;
}

// Helper to find the arrow function node itself
function find_arrow_function(root: SyntaxNode): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "arrow_function") {
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

describe("find_containing_callable with anonymous functions", () => {
  const file_path = "/test.ts" as FilePath;

  it("should return matching SymbolId for arrow function parameters", () => {
    const code = "const fn = (x: number) => x * 2;";
    const root = parse_typescript(code);

    // Find the parameter 'x' node
    const param_node = find_arrow_function_param(root, "x");
    expect(param_node).not.toBeNull();

    // Find the arrow function node
    const arrow_node = find_arrow_function(root);
    expect(arrow_node).not.toBeNull();

    // Create capture node for parameter
    const capture: CaptureNode = {
      node: param_node!,
      text: "x" as SymbolName,
      name: "definition.parameter",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
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

    // Expected: anonymous_function_symbol with arrow function's location
    const expected_id = anonymous_function_symbol(node_to_location(arrow_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });

  it("should return matching SymbolId for callback arrow function parameters", () => {
    const code = "items.reduce((acc, item) => acc + item, 0);";
    const root = parse_typescript(code);

    // Find the parameter 'acc' node
    const param_node = find_arrow_function_param(root, "acc");
    expect(param_node).not.toBeNull();

    // Find the arrow function node
    const arrow_node = find_arrow_function(root);
    expect(arrow_node).not.toBeNull();

    // Create capture node for parameter
    const capture: CaptureNode = {
      node: param_node!,
      text: "acc" as SymbolName,
      name: "definition.parameter",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
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

    // Expected: anonymous_function_symbol with arrow function's location
    const expected_id = anonymous_function_symbol(node_to_location(arrow_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });
});

// Helper to find first node of specific type
function find_node_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_node_by_type(node.child(i)!, type);
    if (found) return found;
  }
  return null;
}

describe("extract_class_extends", () => {
  it("should extract simple base class", () => {
    const root = parse_typescript("class Foo extends Bar {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_class_extends(class_node!)).toEqual(["Bar"]);
  });

  it("should extract generic base class: class Foo extends Bar<T>", () => {
    const root = parse_typescript("class Foo extends Bar<T> {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_class_extends(class_node!)).toEqual(["Bar"]);
  });

  it("should extract generic base class with multiple type params", () => {
    const root = parse_typescript("class Foo extends Map<string, number> {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_class_extends(class_node!)).toEqual(["Map"]);
  });

  it("should return empty array for class without extends", () => {
    const root = parse_typescript("class Foo {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_class_extends(class_node!)).toEqual([]);
  });
});

describe("extract_interface_extends", () => {
  it("should extract simple interface extends", () => {
    const root = parse_typescript("interface Foo extends Bar {}");
    const iface_node = find_node_by_type(root, "interface_declaration");
    expect(iface_node).not.toBeNull();
    expect(extract_interface_extends(iface_node!)).toEqual(["Bar"]);
  });

  it("should extract generic interface extends: interface Foo extends Bar<T>", () => {
    const root = parse_typescript("interface Foo extends Bar<T> {}");
    const iface_node = find_node_by_type(root, "interface_declaration");
    expect(iface_node).not.toBeNull();
    expect(extract_interface_extends(iface_node!)).toEqual(["Bar"]);
  });

  it("should extract multiple interface extends with generics", () => {
    const root = parse_typescript("interface Foo extends Bar<T>, Baz<U> {}");
    const iface_node = find_node_by_type(root, "interface_declaration");
    expect(iface_node).not.toBeNull();
    expect(extract_interface_extends(iface_node!)).toEqual(["Bar", "Baz"]);
  });

  it("should extract mix of simple and generic extends", () => {
    const root = parse_typescript("interface Foo extends Bar, Baz<T> {}");
    const iface_node = find_node_by_type(root, "interface_declaration");
    expect(iface_node).not.toBeNull();
    expect(extract_interface_extends(iface_node!)).toEqual(["Bar", "Baz"]);
  });

  it("should return empty array for interface without extends", () => {
    const root = parse_typescript("interface Foo {}");
    const iface_node = find_node_by_type(root, "interface_declaration");
    expect(iface_node).not.toBeNull();
    expect(extract_interface_extends(iface_node!)).toEqual([]);
  });
});

describe("extract_implements", () => {
  it("should extract simple implements", () => {
    const root = parse_typescript("class Foo implements Bar {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_implements(class_node!)).toEqual(["Bar"]);
  });

  it("should extract generic implements: class Foo implements Bar<T>", () => {
    const root = parse_typescript("class Foo implements Bar<T> {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_implements(class_node!)).toEqual(["Bar"]);
  });

  it("should extract multiple generic implements", () => {
    const root = parse_typescript("class Foo implements Bar<T>, Baz<U> {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_implements(class_node!)).toEqual(["Bar", "Baz"]);
  });

  it("should return empty array for class without implements", () => {
    const root = parse_typescript("class Foo {}");
    const class_node = find_node_by_type(root, "class_declaration");
    expect(class_node).not.toBeNull();
    expect(extract_implements(class_node!)).toEqual([]);
  });
});
