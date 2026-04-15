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
  find_containing_class,
  find_containing_interface,
  find_containing_enum,
  find_decorator_target,
  detect_callback_context,
  is_parameter_in_function_type,
} from "./symbol_factories.typescript";
import {
  anonymous_function_symbol,
  class_symbol,
  enum_symbol,
  interface_symbol,
  method_symbol,
  namespace_symbol,
  property_symbol,
  type_symbol,
} from "@ariadnejs/types";
import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import { node_to_location } from "../../node_to_location";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "../../../index_single_file";

// ============================================================================
// Helpers
// ============================================================================

const file_path = "/test.ts" as FilePath;

function parse_typescript(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  const tree = parser.parse(code);
  return tree.rootNode;
}

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

function find_node_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_node_by_type(node.child(i)!, type);
    if (found) return found;
  }
  return null;
}

function find_node_by_type_and_text(node: SyntaxNode, type: string, text: string): SyntaxNode | null {
  if (node.type === type && node.text === text) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_node_by_type_and_text(node.child(i)!, type, text);
    if (found) return found;
  }
  return null;
}

function find_arrow_function_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "arrow_function") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = find_identifier_in_subtree(child, param_name);
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

function find_identifier_in_subtree(node: SyntaxNode, name: string): SyntaxNode | null {
  if (node.type === "identifier" && node.text === name) return node;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = find_identifier_in_subtree(child, name);
      if (result) return result;
    }
  }
  return null;
}

function find_arrow_function(root: SyntaxNode): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "arrow_function") return node;
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

/** Find a method_signature name node inside an interface */
function find_method_signature_name(root: SyntaxNode, name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "method_signature") {
      for (const child of node.children) {
        if (child.type === "property_identifier" && child.text === name) {
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

/** Find a property_signature name node inside an interface */
function find_property_signature_name(root: SyntaxNode, name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "property_signature") {
      for (const child of node.children) {
        if (child.type === "property_identifier" && child.text === name) {
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

/** Create a CaptureNode from a SyntaxNode */
function make_capture(
  node: SyntaxNode,
  capture_name: string,
  category: SemanticCategory,
  entity: SemanticEntity,
): CaptureNode {
  return {
    node,
    text: node.text as SymbolName,
    name: capture_name,
    category,
    entity,
    location: {
      file_path,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column,
    },
  };
}

// ============================================================================
// Symbol ID Creation Tests
// ============================================================================

describe("create_interface_id", () => {
  it("should create an interface SymbolId from a parsed interface name node", () => {
    const root = parse_typescript("interface Foo {}");
    const name_node = find_node_by_type_and_text(root, "type_identifier", "Foo")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.interface", SemanticCategory.DEFINITION, SemanticEntity.INTERFACE);
    const result = create_interface_id(capture);

    expect(result).toBe(interface_symbol("Foo" as SymbolName, capture.location));
    expect(result).toMatch(/^interface:\/test\.ts:\d+:\d+:\d+:\d+:Foo$/);
  });
});

describe("create_type_alias_id", () => {
  it("should create a type SymbolId from a parsed type alias name node", () => {
    const root = parse_typescript("type Foo = string;");
    const name_node = find_node_by_type_and_text(root, "type_identifier", "Foo")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.type_alias", SemanticCategory.DEFINITION, SemanticEntity.TYPE_ALIAS);
    const result = create_type_alias_id(capture);

    expect(result).toBe(type_symbol("Foo" as SymbolName, capture.location));
    expect(result).toMatch(/^type:\/test\.ts:\d+:\d+:\d+:\d+:Foo$/);
  });
});

describe("create_enum_id", () => {
  it("should create an enum SymbolId from a parsed enum name node", () => {
    const root = parse_typescript("enum Color { Red, Green, Blue }");
    const name_node = find_node_by_type_and_text(root, "identifier", "Color")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.enum", SemanticCategory.DEFINITION, SemanticEntity.ENUM);
    const result = create_enum_id(capture);

    expect(result).toBe(enum_symbol("Color" as SymbolName, capture.location));
    expect(result).toMatch(/^enum:\/test\.ts:\d+:\d+:\d+:\d+:Color$/);
  });
});

describe("create_namespace_id", () => {
  it("should create a namespace SymbolId from a parsed namespace name node", () => {
    const root = parse_typescript("namespace MyNS {}");
    const name_node = find_node_by_type_and_text(root, "identifier", "MyNS")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.namespace", SemanticCategory.DEFINITION, SemanticEntity.NAMESPACE);
    const result = create_namespace_id(capture);

    expect(result).toBe(namespace_symbol("MyNS" as SymbolName, capture.location));
    expect(result).toMatch(/^namespace:\/test\.ts:\d+:\d+:\d+:\d+:MyNS$/);
  });
});

describe("create_enum_member_id", () => {
  it("should create an enum member SymbolId composed of enum_id and member name", () => {
    const root = parse_typescript("enum Color { Red, Green }");
    const enum_name_node = find_node_by_type_and_text(root, "identifier", "Color")!;
    const member_node = find_node_by_type_and_text(root, "property_identifier", "Red")!;
    expect(enum_name_node).not.toBeNull();
    expect(member_node).not.toBeNull();

    const enum_capture = make_capture(enum_name_node, "definition.enum", SemanticCategory.DEFINITION, SemanticEntity.ENUM);
    const enum_id = create_enum_id(enum_capture);

    const member_capture = make_capture(member_node, "definition.enum_member", SemanticCategory.DEFINITION, SemanticEntity.ENUM_MEMBER);
    const result = create_enum_member_id(member_capture, enum_id);

    expect(result).toBe(`${enum_id}:Red`);
  });
});

describe("create_method_signature_id", () => {
  it("should create a method SymbolId from an interface method signature", () => {
    const root = parse_typescript("interface Foo { greet(name: string): void; }");
    const name_node = find_method_signature_name(root, "greet")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = create_method_signature_id(capture);

    expect(result).toBe(method_symbol("greet" as SymbolName, capture.location));
    expect(result).toMatch(/^method:\/test\.ts:\d+:\d+:\d+:\d+:greet$/);
  });
});

describe("create_property_signature_id", () => {
  it("should create a property SymbolId from an interface property signature", () => {
    const root = parse_typescript("interface Foo { name: string; }");
    const name_node = find_property_signature_name(root, "name")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.property", SemanticCategory.DEFINITION, SemanticEntity.PROPERTY);
    const result = create_property_signature_id(capture);

    expect(result).toBe(property_symbol("name" as SymbolName, capture.location));
    expect(result).toMatch(/^property:\/test\.ts:\d+:\d+:\d+:\d+:name$/);
  });
});

describe("create_class_id", () => {
  it("should create a class SymbolId from a parsed class name node", () => {
    const root = parse_typescript("class MyClass {}");
    const name_node = find_node_by_type_and_text(root, "type_identifier", "MyClass")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.class", SemanticCategory.DEFINITION, SemanticEntity.CLASS);
    const result = create_class_id(capture);

    expect(result).toBe(class_symbol("MyClass" as SymbolName, capture.location));
    expect(result).toMatch(/^class:\/test\.ts:\d+:\d+:\d+:\d+:MyClass$/);
  });
});

describe("create_method_id", () => {
  it("should create a method SymbolId from a class method name node", () => {
    const root = parse_typescript("class Foo { doWork() {} }");
    const name_node = find_method_name_node(root, "doWork")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = create_method_id(capture);

    expect(result).toBe(method_symbol("doWork" as SymbolName, capture.location));
    expect(result).toMatch(/^method:\/test\.ts:\d+:\d+:\d+:\d+:doWork$/);
  });
});

describe("create_parameter_id", () => {
  it("should create a parameter SymbolId from a function parameter node", () => {
    const root = parse_typescript("function greet(name: string) {}");
    const name_node = find_node_by_type_and_text(root, "identifier", "name")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const result = create_parameter_id(capture);

    expect(result).toMatch(/^parameter:\/test\.ts:\d+:\d+:\d+:\d+:name$/);
  });
});

describe("create_property_id", () => {
  it("should create a property SymbolId from a class property name node", () => {
    const root = parse_typescript("class Foo { count: number = 0; }");
    const name_node = find_property_name_node(root, "count")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.property", SemanticCategory.DEFINITION, SemanticEntity.PROPERTY);
    const result = create_property_id(capture);

    expect(result).toBe(property_symbol("count" as SymbolName, capture.location));
    expect(result).toMatch(/^property:\/test\.ts:\d+:\d+:\d+:\d+:count$/);
  });
});

// ============================================================================
// extract_access_modifier (existing behavioral tests kept)
// ============================================================================

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
    const method_node = find_node_by_type_and_text(root, "private_property_identifier", "#privateMethod");
    expect(method_node).not.toBeNull();
    expect(extract_access_modifier(method_node!)).toBe("private");
  });

  it("should detect private # syntax for properties", () => {
    const code = `
class MyClass {
  #privateField = 0;
}`;
    const root = parse_typescript(code);
    const prop_node = find_node_by_type_and_text(root, "private_property_identifier", "#privateField");
    expect(prop_node).not.toBeNull();
    expect(extract_access_modifier(prop_node!)).toBe("private");
  });
});

// ============================================================================
// find_containing_callable (existing behavioral tests kept)
// ============================================================================

describe("find_containing_callable", () => {
  it("should return anonymous function SymbolId for arrow function parameters", () => {
    const code = "const fn = (x: number) => x * 2;";
    const root = parse_typescript(code);

    const param_node = find_arrow_function_param(root, "x")!;
    expect(param_node).not.toBeNull();

    const arrow_node = find_arrow_function(root)!;
    expect(arrow_node).not.toBeNull();

    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const callable_id = find_containing_callable(capture);

    const expected_id = anonymous_function_symbol(node_to_location(arrow_node, file_path));
    expect(callable_id).toBe(expected_id);
  });

  it("should return anonymous function SymbolId for callback arrow function parameters", () => {
    const code = "items.reduce((acc, item) => acc + item, 0);";
    const root = parse_typescript(code);

    const param_node = find_arrow_function_param(root, "acc")!;
    expect(param_node).not.toBeNull();

    const arrow_node = find_arrow_function(root)!;
    expect(arrow_node).not.toBeNull();

    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const callable_id = find_containing_callable(capture);

    const expected_id = anonymous_function_symbol(node_to_location(arrow_node, file_path));
    expect(callable_id).toBe(expected_id);
  });

  it("should return method SymbolId for parameter inside a class method", () => {
    const code = "class Foo { bar(x: number) { return x; } }";
    const root = parse_typescript(code);

    // Find "x" identifier inside the method
    const method_node = find_node_by_type(root, "method_definition")!;
    const param_node = find_identifier_in_subtree(method_node, "x")!;
    expect(param_node).not.toBeNull();

    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const result = find_containing_callable(capture);

    expect(result).toMatch(/^method:\/test\.ts:\d+:\d+:\d+:\d+:bar$/);
  });

  it("should return function SymbolId for parameter inside a named function", () => {
    const code = "function greet(name: string) { return name; }";
    const root = parse_typescript(code);

    const func_node = find_node_by_type(root, "function_declaration")!;
    const param_node = find_identifier_in_subtree(func_node, "name")!;
    expect(param_node).not.toBeNull();

    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const result = find_containing_callable(capture);

    expect(result).toMatch(/^function:\/test\.ts:\d+:\d+:\d+:\d+:greet$/);
  });
});

// ============================================================================
// extract_class_extends (existing behavioral tests kept)
// ============================================================================

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

// ============================================================================
// extract_interface_extends (existing behavioral tests kept)
// ============================================================================

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

// ============================================================================
// extract_implements (existing behavioral tests kept)
// ============================================================================

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

// ============================================================================
// find_containing_class
// ============================================================================

describe("find_containing_class", () => {
  it("should find the containing class for a method name node", () => {
    const code = "class MyClass { doWork() {} }";
    const root = parse_typescript(code);
    const method_node = find_method_name_node(root, "doWork")!;
    expect(method_node).not.toBeNull();

    const capture = make_capture(method_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = find_containing_class(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^class:\/test\.ts:\d+:\d+:\d+:\d+:MyClass$/);
  });

  it("should return undefined for a function not inside a class", () => {
    const code = "function standalone() {}";
    const root = parse_typescript(code);
    const name_node = find_node_by_type_and_text(root, "identifier", "standalone")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.function", SemanticCategory.DEFINITION, SemanticEntity.FUNCTION);
    const result = find_containing_class(capture);

    expect(result).toBeUndefined();
  });

  it("should find abstract class as containing class", () => {
    const code = "abstract class Base { abstract run(): void; }";
    const root = parse_typescript(code);
    // abstract methods use abstract_method_signature; find property_identifier "run" inside it
    const abstract_sig = find_node_by_type(root, "abstract_method_signature")!;
    expect(abstract_sig).not.toBeNull();
    const name_node = find_node_by_type_and_text(abstract_sig, "property_identifier", "run")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = find_containing_class(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^class:\/test\.ts:\d+:\d+:\d+:\d+:Base$/);
  });
});

// ============================================================================
// find_containing_interface
// ============================================================================

describe("find_containing_interface", () => {
  it("should find the containing interface for a method signature", () => {
    const code = "interface IService { start(): void; }";
    const root = parse_typescript(code);
    const name_node = find_method_signature_name(root, "start")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = find_containing_interface(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^interface:\/test\.ts:\d+:\d+:\d+:\d+:IService$/);
  });

  it("should find the containing interface for a property signature", () => {
    const code = "interface Config { port: number; }";
    const root = parse_typescript(code);
    const name_node = find_property_signature_name(root, "port")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.property", SemanticCategory.DEFINITION, SemanticEntity.PROPERTY);
    const result = find_containing_interface(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^interface:\/test\.ts:\d+:\d+:\d+:\d+:Config$/);
  });

  it("should return undefined for a method not inside an interface", () => {
    const code = "class Foo { bar() {} }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "bar")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = find_containing_interface(capture);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// find_containing_enum
// ============================================================================

describe("find_containing_enum", () => {
  it("should find the containing enum for an enum member", () => {
    const code = "enum Color { Red, Green, Blue }";
    const root = parse_typescript(code);
    const member_node = find_node_by_type_and_text(root, "property_identifier", "Red")!;
    expect(member_node).not.toBeNull();

    const capture = make_capture(member_node, "definition.enum_member", SemanticCategory.DEFINITION, SemanticEntity.ENUM_MEMBER);
    const result = find_containing_enum(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^enum:\/test\.ts:\d+:\d+:\d+:\d+:Color$/);
  });

  it("should return undefined for a node not inside an enum", () => {
    const code = "const Red = 1;";
    const root = parse_typescript(code);
    const name_node = find_node_by_type_and_text(root, "identifier", "Red")!;
    expect(name_node).not.toBeNull();

    const capture = make_capture(name_node, "definition.variable", SemanticCategory.DEFINITION, SemanticEntity.VARIABLE);
    const result = find_containing_enum(capture);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// find_decorator_target
// ============================================================================

describe("find_decorator_target", () => {
  it("should find the class target for a class decorator", () => {
    const code = "@Component\nclass MyWidget {}";
    const root = parse_typescript(code);
    const decorator_node = find_node_by_type(root, "decorator")!;
    expect(decorator_node).not.toBeNull();

    const capture = make_capture(decorator_node, "decorator.class", SemanticCategory.DECORATOR, SemanticEntity.CLASS);
    const result = find_decorator_target(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^class:\/test\.ts:\d+:\d+:\d+:\d+:MyWidget$/);
  });

  it("should find the method target for a method decorator", () => {
    const code = "class Foo {\n  @Log\n  run() {}\n}";
    const root = parse_typescript(code);

    // Find the decorator inside the class body
    const class_body = find_node_by_type(root, "class_body")!;
    let decorator_node: SyntaxNode | null = null;
    for (const child of class_body.children) {
      if (child.type === "decorator") {
        decorator_node = child;
        break;
      }
    }
    expect(decorator_node).not.toBeNull();

    const capture = make_capture(decorator_node!, "decorator.method", SemanticCategory.DECORATOR, SemanticEntity.METHOD);
    const result = find_decorator_target(capture);

    expect(result).toBeDefined();
    expect(result).toMatch(/^method:\/test\.ts:\d+:\d+:\d+:\d+:run$/);
  });
});

// ============================================================================
// detect_callback_context
// ============================================================================

describe("detect_callback_context", () => {
  it("should detect arrow function in call arguments as a callback", () => {
    const code = "items.forEach((item) => console.log(item));";
    const root = parse_typescript(code);
    const arrow_node = find_arrow_function(root)!;
    expect(arrow_node).not.toBeNull();

    const result = detect_callback_context(arrow_node, file_path);

    expect(result.is_callback).toBe(true);
    expect(result.receiver_location).not.toBeNull();
    expect(result.receiver_is_external).toBeNull();
  });

  it("should return not-a-callback for arrow function assigned to a variable", () => {
    const code = "const fn = (x: number) => x * 2;";
    const root = parse_typescript(code);
    const arrow_node = find_arrow_function(root)!;
    expect(arrow_node).not.toBeNull();

    const result = detect_callback_context(arrow_node, file_path);

    expect(result.is_callback).toBe(false);
    expect(result.receiver_location).toBeNull();
  });

  it("should detect arrow function in new expression as a callback", () => {
    const code = "new Promise((resolve) => resolve(42));";
    const root = parse_typescript(code);
    const arrow_node = find_arrow_function(root)!;
    expect(arrow_node).not.toBeNull();

    const result = detect_callback_context(arrow_node, file_path);

    expect(result.is_callback).toBe(true);
    expect(result.receiver_location).not.toBeNull();
  });
});

// ============================================================================
// is_parameter_in_function_type
// ============================================================================

describe("is_parameter_in_function_type", () => {
  it("should return true for a parameter inside a function type annotation", () => {
    const code = "type Fn = (x: number) => void;";
    const root = parse_typescript(code);

    // Find the "x" identifier inside the function_type
    const function_type_node = find_node_by_type(root, "function_type")!;
    expect(function_type_node).not.toBeNull();
    const x_node = find_identifier_in_subtree(function_type_node, "x")!;
    expect(x_node).not.toBeNull();

    expect(is_parameter_in_function_type(x_node)).toBe(true);
  });

  it("should return false for a parameter inside a real function", () => {
    const code = "function greet(name: string) {}";
    const root = parse_typescript(code);
    const name_node = find_identifier_in_subtree(root, "name")!;
    expect(name_node).not.toBeNull();

    expect(is_parameter_in_function_type(name_node)).toBe(false);
  });

  it("should return false for a parameter inside an arrow function", () => {
    const code = "const fn = (y: number) => y;";
    const root = parse_typescript(code);
    const y_node = find_arrow_function_param(root, "y")!;
    expect(y_node).not.toBeNull();

    expect(is_parameter_in_function_type(y_node)).toBe(false);
  });
});

// ============================================================================
// extract_type_parameters
// ============================================================================

describe("extract_type_parameters", () => {
  it("should extract type parameters from an interface with generics", () => {
    const code = "interface Foo<T, U> {}";
    const root = parse_typescript(code);
    const iface_node = find_node_by_type(root, "interface_declaration")!;
    expect(iface_node).not.toBeNull();

    const result = extract_type_parameters(iface_node);
    expect(result).toEqual(["T", "U"]);
  });

  it("should extract single type parameter from a class", () => {
    const code = "class Container<T> {}";
    const root = parse_typescript(code);
    const class_node = find_node_by_type(root, "class_declaration")!;
    expect(class_node).not.toBeNull();

    const result = extract_type_parameters(class_node);
    expect(result).toEqual(["T"]);
  });

  it("should return empty array for interface without type parameters", () => {
    const code = "interface Foo {}";
    const root = parse_typescript(code);
    const iface_node = find_node_by_type(root, "interface_declaration")!;
    expect(iface_node).not.toBeNull();

    const result = extract_type_parameters(iface_node);
    expect(result).toEqual([]);
  });

  it("should return empty array for null input", () => {
    const result = extract_type_parameters(null);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// extract_return_type
// ============================================================================

describe("extract_return_type", () => {
  it("should extract return type from a method", () => {
    const code = "class Foo { getValue(): number { return 0; } }";
    const root = parse_typescript(code);
    const method_name = find_method_name_node(root, "getValue")!;
    expect(method_name).not.toBeNull();

    const result = extract_return_type(method_name);
    expect(result).toBe("number");
  });

  it("should extract complex return type from a method", () => {
    const code = "class Foo { getData(): Promise<string[]> { return []; } }";
    const root = parse_typescript(code);
    const method_name = find_method_name_node(root, "getData")!;
    expect(method_name).not.toBeNull();

    const result = extract_return_type(method_name);
    expect(result).toBe("Promise<string[]>");
  });

  it("should return undefined when no return type is specified", () => {
    const code = "class Foo { doWork() {} }";
    const root = parse_typescript(code);
    const method_name = find_method_name_node(root, "doWork")!;
    expect(method_name).not.toBeNull();

    const result = extract_return_type(method_name);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// extract_property_type
// ============================================================================

describe("extract_property_type", () => {
  it("should extract type from a class property", () => {
    const code = "class Foo { count: number = 0; }";
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "count")!;
    expect(prop_node).not.toBeNull();

    const result = extract_property_type(prop_node);
    expect(result).toBe("number");
  });

  it("should extract complex type from a property", () => {
    const code = "class Foo { items: Map<string, number[]>; }";
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "items")!;
    expect(prop_node).not.toBeNull();

    const result = extract_property_type(prop_node);
    expect(result).toBe("Map<string, number[]>");
  });

  it("should return undefined when no type annotation is present", () => {
    const code = "class Foo { count = 0; }";
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "count")!;
    expect(prop_node).not.toBeNull();

    const result = extract_property_type(prop_node);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// extract_parameter_type
// ============================================================================

describe("extract_parameter_type", () => {
  it("should extract type from a regular parameter", () => {
    const code = "function greet(name: string) {}";
    const root = parse_typescript(code);
    // Find the "name" identifier inside the formal_parameters
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const name_node = find_identifier_in_subtree(params_node, "name")!;
    expect(name_node).not.toBeNull();

    const result = extract_parameter_type(name_node);
    expect(result).toBe("string");
  });

  it("should extract type from a rest parameter", () => {
    const code = "function sum(...nums: number[]) {}";
    const root = parse_typescript(code);
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const nums_node = find_identifier_in_subtree(params_node, "nums")!;
    expect(nums_node).not.toBeNull();

    const result = extract_parameter_type(nums_node);
    expect(result).toBe("number[]");
  });

  it("should return undefined for parameter without type annotation", () => {
    const code = "function greet(name) {}";
    const root = parse_typescript(code);
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const name_node = find_identifier_in_subtree(params_node, "name")!;
    expect(name_node).not.toBeNull();

    const result = extract_parameter_type(name_node);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// extract_parameter_default_value
// ============================================================================

describe("extract_parameter_default_value", () => {
  it("should extract default value from an optional parameter", () => {
    const code = "function greet(name: string = \"world\") {}";
    const root = parse_typescript(code);
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const name_node = find_identifier_in_subtree(params_node, "name")!;
    expect(name_node).not.toBeNull();

    const result = extract_parameter_default_value(name_node);
    expect(result).toBe("\"world\"");
  });

  it("should extract numeric default value", () => {
    const code = "function count(n: number = 10) {}";
    const root = parse_typescript(code);
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const n_node = find_identifier_in_subtree(params_node, "n")!;
    expect(n_node).not.toBeNull();

    const result = extract_parameter_default_value(n_node);
    expect(result).toBe("10");
  });

  it("should return undefined for parameter without default value", () => {
    const code = "function greet(name: string) {}";
    const root = parse_typescript(code);
    const func_node = find_node_by_type(root, "function_declaration")!;
    const params_node = find_node_by_type(func_node, "formal_parameters")!;
    const name_node = find_identifier_in_subtree(params_node, "name")!;
    expect(name_node).not.toBeNull();

    const result = extract_parameter_default_value(name_node);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// is_readonly_property
// ============================================================================

describe("is_readonly_property", () => {
  it("should return true for a readonly property", () => {
    const code = "class Foo { readonly name: string = \"\"; }";
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "name")!;
    expect(prop_node).not.toBeNull();

    expect(is_readonly_property(prop_node)).toBe(true);
  });

  it("should return false for a non-readonly property", () => {
    const code = "class Foo { name: string = \"\"; }";
    const root = parse_typescript(code);
    const prop_node = find_property_name_node(root, "name")!;
    expect(prop_node).not.toBeNull();

    expect(is_readonly_property(prop_node)).toBe(false);
  });
});

// ============================================================================
// is_abstract_method
// ============================================================================

describe("is_abstract_method", () => {
  it("should return true for an abstract method", () => {
    const code = "abstract class Foo { abstract run(): void; }";
    const root = parse_typescript(code);
    // abstract methods use abstract_method_signature in tree-sitter
    const abstract_sig = find_node_by_type(root, "abstract_method_signature")!;
    expect(abstract_sig).not.toBeNull();
    const name_node = find_node_by_type_and_text(abstract_sig, "property_identifier", "run")!;
    expect(name_node).not.toBeNull();

    expect(is_abstract_method(name_node)).toBe(true);
  });

  it("should return false for a non-abstract method", () => {
    const code = "class Foo { run(): void {} }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "run")!;
    expect(name_node).not.toBeNull();

    expect(is_abstract_method(name_node)).toBe(false);
  });
});

// ============================================================================
// is_static_method
// ============================================================================

describe("is_static_method", () => {
  it("should return true for a static method", () => {
    const code = "class Foo { static create(): Foo { return new Foo(); } }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "create")!;
    expect(name_node).not.toBeNull();

    expect(is_static_method(name_node)).toBe(true);
  });

  it("should return false for a non-static method", () => {
    const code = "class Foo { run(): void {} }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "run")!;
    expect(name_node).not.toBeNull();

    expect(is_static_method(name_node)).toBe(false);
  });
});

// ============================================================================
// is_async_method
// ============================================================================

describe("is_async_method", () => {
  it("should return true for an async method", () => {
    const code = "class Foo { async fetchData(): Promise<void> {} }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "fetchData")!;
    expect(name_node).not.toBeNull();

    expect(is_async_method(name_node)).toBe(true);
  });

  it("should return false for a non-async method", () => {
    const code = "class Foo { run(): void {} }";
    const root = parse_typescript(code);
    const name_node = find_method_name_node(root, "run")!;
    expect(name_node).not.toBeNull();

    expect(is_async_method(name_node)).toBe(false);
  });
});
