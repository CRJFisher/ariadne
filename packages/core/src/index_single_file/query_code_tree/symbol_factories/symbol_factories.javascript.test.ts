/**
 * Tests for JavaScript symbol factories
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
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
  extract_call_initializer_name,
  detect_callback_context,
  detect_function_collection,
} from "./symbol_factories.javascript";

// Parsers for tree-sitter
let js_parser: Parser;
let ts_parser: Parser;

beforeAll(() => {
  js_parser = new Parser();
  js_parser.setLanguage(JavaScript);
  ts_parser = new Parser();
  ts_parser.setLanguage(TypeScript.typescript);
});

// Helper to parse code and get AST root
function parse_js(code: string): SyntaxNode {
  return js_parser.parse(code).rootNode;
}

function parse_ts(code: string): SyntaxNode {
  return ts_parser.parse(code).rootNode;
}

// Helper to find first node of specific type
function find_node_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_node_by_type(node.child(i)!, type);
    if (found) return found;
  }
  return null;
}

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

describe("extract_call_initializer_name", () => {
  it("should extract function name from plain call: const x = foo()", () => {
    const root = parse_js("const x = foo()");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBe("foo");
  });

  it("should extract function name with underscore: const x = get_scope_boundary_extractor()", () => {
    const root = parse_js("const x = get_scope_boundary_extractor()");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBe("get_scope_boundary_extractor");
  });

  it("should return undefined for method calls: const x = obj.method()", () => {
    const root = parse_js("const x = obj.method()");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBeUndefined();
  });

  it("should return undefined for method calls with args: const x = config.get('key')", () => {
    const root = parse_js("const x = config.get('key')");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBeUndefined();
  });

  it("should handle call with arguments: const x = foo(arg1, arg2)", () => {
    const root = parse_js("const x = foo(arg1, arg2)");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBe("foo");
  });

  it("should return undefined for non-call initializers: const x = 42", () => {
    const root = parse_js("const x = 42");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBeUndefined();
  });

  it("should return undefined for string initializers: const x = 'hello'", () => {
    const root = parse_js("const x = 'hello'");
    const identifier = find_node_by_type(root, "identifier");
    expect(identifier).not.toBeNull();
    const result = extract_call_initializer_name(identifier!);
    expect(result).toBeUndefined();
  });
});

describe("extract_extends", () => {
  describe("JavaScript heritage path", () => {
    it("should extract parent class from JavaScript class extends", () => {
      const root = parse_js("class Foo extends Bar {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar"]);
    });

    it("should return empty array for class without extends", () => {
      const root = parse_js("class Foo {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual([]);
    });
  });

  describe("TypeScript class_heritage path", () => {
    it("should extract from extends_clause", () => {
      const root = parse_ts("class Foo extends Bar {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar"]);
    });

    it("should extract from implements_clause", () => {
      const root = parse_ts("class Foo implements IFoo {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["IFoo"]);
    });

    it("should extract both extends and implements", () => {
      const root = parse_ts("class Foo extends Bar implements IFoo {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar", "IFoo"]);
    });

    it("should handle multiple implemented interfaces", () => {
      const root = parse_ts("class Foo implements A, B, C {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["A", "B", "C"]);
    });

    it("should return empty array for TypeScript class without extends or implements", () => {
      const root = parse_ts("class Foo {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual([]);
    });
  });
});
