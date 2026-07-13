/**
 * Tests for JavaScript symbol factories
 */

import { describe, it, expect } from "vitest";
import { parse_js, find_node_by_type } from "./test_utils";
import Parser from "tree-sitter";
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
  extract_collection_source,
  extract_extends,
  extract_call_initializer_name,
  detect_callback_context,
  detect_function_collection,
  find_containing_callable,
  find_containing_class,
} from "./symbol_factories.javascript";
import { anonymous_function_symbol } from "@ariadnejs/types";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import { extract_jsdoc_type } from "./jsdoc_extraction.javascript";
import { node_to_location } from "../../node_to_location";
import { SemanticCategory, SemanticEntity, type CaptureNode } from "../../capture_types";

const file_path = "/test.js" as FilePath;

function parse_ts(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  return parser.parse(code).rootNode;
}

// Helper to find all nodes of specific type
function find_all_nodes_by_type(node: SyntaxNode, type: string): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  function visit(n: SyntaxNode) {
    if (n.type === type) results.push(n);
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) visit(child);
    }
  }
  visit(node);
  return results;
}

// Helper to build a CaptureNode from a tree-sitter node
function make_capture(
  node: SyntaxNode,
  name: string,
  category: SemanticCategory,
  entity: SemanticEntity,
): CaptureNode {
  return {
    node,
    text: node.text as SymbolName,
    name,
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

// Helper to find a parameter node inside an arrow function
function find_arrow_function_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "arrow_function") {
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
  return find_node_by_type(root, "arrow_function");
}

// ============================================================================
// Symbol ID Creation
// ============================================================================

describe("create_class_id", () => {
  it("should create class symbol from parsed code", () => {
    const root = parse_js("class Foo {}");
    const class_node = find_node_by_type(root, "class_declaration")!;
    const name_node = class_node.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.class", SemanticCategory.DEFINITION, SemanticEntity.CLASS);
    const id = create_class_id(capture);
    expect(id).toMatch(/^class:.*:Foo$/);
  });
});

describe("create_method_id", () => {
  it("should create method symbol from parsed code", () => {
    const root = parse_js("class Foo { bar() {} }");
    const method_node = find_node_by_type(root, "method_definition")!;
    const name_node = method_node.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const id = create_method_id(capture);
    expect(id).toMatch(/^method:.*:bar$/);
  });
});

describe("create_function_id", () => {
  it("should create function symbol from parsed code", () => {
    const root = parse_js("function greet() {}");
    const func_node = find_node_by_type(root, "function_declaration")!;
    const name_node = func_node.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.function", SemanticCategory.DEFINITION, SemanticEntity.FUNCTION);
    const id = create_function_id(capture);
    expect(id).toMatch(/^function:.*:greet$/);
  });
});

describe("create_variable_id", () => {
  it("should create variable symbol from parsed code", () => {
    const root = parse_js("const count = 42;");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.variable", SemanticCategory.DEFINITION, SemanticEntity.VARIABLE);
    const id = create_variable_id(capture);
    expect(id).toMatch(/^variable:.*:count$/);
  });
});

describe("create_parameter_id", () => {
  it("should create parameter symbol from parsed code", () => {
    const root = parse_js("function greet(name) {}");
    const params = find_node_by_type(root, "formal_parameters")!;
    const name_node = find_node_by_type(params, "identifier")!;
    const capture = make_capture(name_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const id = create_parameter_id(capture);
    expect(id).toMatch(/^parameter:.*:name$/);
  });
});

describe("create_property_id", () => {
  it("should create property symbol from parsed code", () => {
    const root = parse_js("class Foo { x = 1; }");
    const field = find_node_by_type(root, "field_definition")!;
    const name_node = find_node_by_type(field, "property_identifier")!;
    const capture = make_capture(name_node, "definition.property", SemanticCategory.DEFINITION, SemanticEntity.PROPERTY);
    const id = create_property_id(capture);
    expect(id).toMatch(/^property:.*:x$/);
  });
});

describe("create_import_id", () => {
  it("should create import symbol as variable from parsed code", () => {
    const root = parse_js("import foo from './bar';");
    const import_clause = find_node_by_type(root, "import_clause")!;
    const name_node = find_node_by_type(import_clause, "identifier")!;
    const capture = make_capture(name_node, "import.import", SemanticCategory.IMPORT, SemanticEntity.IMPORT);
    const id = create_import_id(capture);
    // Imports are stored as variable symbols
    expect(id).toMatch(/^variable:.*:foo$/);
  });
});

// ============================================================================
// Type Extraction
// ============================================================================

describe("extract_return_type", () => {
  it("should extract return type from TypeScript function", () => {
    const root = parse_ts("function greet(): string { return ''; }");
    const func_node = find_node_by_type(root, "function_declaration")!;
    const result = extract_return_type(func_node);
    expect(result).toBe(": string");
  });

  it("should return undefined for JS function without return type", () => {
    const root = parse_js("function greet() { return ''; }");
    const func_node = find_node_by_type(root, "function_declaration")!;
    const result = extract_return_type(func_node);
    expect(result).toBeUndefined();
  });
});

describe("extract_parameter_type", () => {
  it("should extract type annotation from TypeScript parameter", () => {
    const root = parse_ts("function greet(name: string) {}");
    // Find the required_parameter node which has the type field
    const param_node = find_node_by_type(root, "required_parameter")!;
    const result = extract_parameter_type(param_node);
    expect(result).toBe(": string");
  });

  it("should return undefined for JS parameter without type", () => {
    const root = parse_js("function greet(name) {}");
    const params = find_node_by_type(root, "formal_parameters")!;
    const param_node = find_node_by_type(params, "identifier")!;
    const result = extract_parameter_type(param_node);
    expect(result).toBeUndefined();
  });

  // Finds the parameter identifier named `name` declared in a parameter list.
  // Mirrors the @definition.parameter capture in javascript.scm: a direct
  // identifier in formal_parameters, a rest_pattern, an assignment_pattern, or a
  // catch_clause.
  function find_param(root: SyntaxNode, name: string): SyntaxNode {
    const PARAM_PARENTS = new Set([
      "formal_parameters",
      "rest_pattern",
      "assignment_pattern",
      "catch_clause",
    ]);
    const match = find_all_nodes_by_type(root, "identifier").find(
      (n) => n.text === name && PARAM_PARENTS.has(n.parent!.type)
    );
    if (!match) throw new Error(`parameter ${name} not found`);
    return match;
  }

  it("types a function parameter from a JSDoc @param {T} name tag", () => {
    const root = parse_js("/** @param {ModuleGraph} g */\nfunction build(g) {}");
    const result = extract_parameter_type(find_param(root, "g"));
    expect(result).toBe("ModuleGraph" as SymbolName);
  });

  it("types a method parameter from a JSDoc @param tag inside a class", () => {
    const root = parse_js(
      "class C {\n  /** @param {ModuleGraph} g */\n  build(g) {}\n}"
    );
    const result = extract_parameter_type(find_param(root, "g"));
    expect(result).toBe("ModuleGraph" as SymbolName);
  });

  it("types an arrow parameter whose const declaration carries the JSDoc", () => {
    const root = parse_js("/** @param {Compilation} c */\nconst f = (c) => c;");
    const result = extract_parameter_type(find_param(root, "c"));
    expect(result).toBe("Compilation" as SymbolName);
  });

  it("matches the @param tag for the right name among multiple", () => {
    const root = parse_js(
      "/**\n * @param {Foo} a\n * @param {Bar} b\n */\nfunction f(a, b) {}"
    );
    expect(extract_parameter_type(find_param(root, "a"))).toBe("Foo" as SymbolName);
    expect(extract_parameter_type(find_param(root, "b"))).toBe("Bar" as SymbolName);
  });

  it("preserves a verbatim generic JSDoc param type", () => {
    const root = parse_js(
      "/** @param {Array<Module>} mods */\nfunction f(mods) {}"
    );
    const result = extract_parameter_type(find_param(root, "mods"));
    expect(result).toBe("Array<Module>" as SymbolName);
  });

  it("types an optional parameter declared with @param {T} [name]", () => {
    const root = parse_js("/** @param {Compilation} [c] */\nfunction f(c) {}");
    const result = extract_parameter_type(find_param(root, "c"));
    expect(result).toBe("Compilation" as SymbolName);
  });

  it("does not type a catch-clause variable from a same-named function @param", () => {
    const root = parse_js(
      "/** @param {Foo} e */\nfunction handle(e) {\n  try {\n    run();\n  } catch (e) {\n    e.report();\n  }\n}"
    );
    const catch_clause = find_node_by_type(root, "catch_clause")!;
    const catch_var = find_node_by_type(catch_clause, "identifier")!;
    expect(catch_var.parent!.type).toBe("catch_clause");
    expect(extract_parameter_type(catch_var)).toBeUndefined();
  });

  it("does not type a bare param from a dotted @param {T} options.foo tag", () => {
    const root = parse_js(
      "/** @param {string} options.foo */\nfunction f(options) {}"
    );
    const result = extract_parameter_type(find_param(root, "options"));
    expect(result).toBeUndefined();
  });

  it("prefers a structural TypeScript annotation over JSDoc when both exist", () => {
    const root = parse_ts(
      "/** @param {Wrong} g */\nfunction f(g: Right) {}"
    );
    const param_node = find_node_by_type(root, "required_parameter")!;
    const result = extract_parameter_type(param_node);
    expect(result).toBe(": Right");
  });
});

describe("extract_jsdoc_type", () => {
  it("should extract type from @type annotation", () => {
    const comment = "/** @type {string} */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBe("string");
  });

  it("should extract complex type from @type annotation", () => {
    const comment = "/** @type {Map<string, number>} */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBe("Map<string, number>");
  });

  it("should return undefined for comments without type", () => {
    const comment = "/** Just a comment */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBeUndefined();
  });

  it("should extract type from multi-line JSDoc", () => {
    const comment = "/**\n * @type {number}\n */";
    const result = extract_jsdoc_type(comment);
    expect(result).toBe("number");
  });
});

// ============================================================================
// Import Extraction
// ============================================================================

// ============================================================================
// Inheritance Extraction
// ============================================================================

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

    it("should extract generic base class: class Foo extends Bar<T>", () => {
      const root = parse_ts("class Foo extends Bar<T> {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar"]);
    });

    it("should extract generic implements: class Foo implements Bar<T>", () => {
      const root = parse_ts("class Foo implements Bar<T> {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar"]);
    });

    it("should extract both generic extends and implements", () => {
      const root = parse_ts("class Foo extends Bar<T> implements Baz<U> {}");
      const class_node = find_node_by_type(root, "class_declaration");
      expect(class_node).not.toBeNull();
      const result = extract_extends(class_node!);
      expect(result).toEqual(["Bar", "Baz"]);
    });
  });
});

// ============================================================================
// Value Extraction
// ============================================================================

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

// ============================================================================
// Collection Source Extraction
// ============================================================================

describe("extract_collection_source", () => {
  it("should extract source from method call: config.get('key')", () => {
    const root = parse_js("const handler = config.get('key');");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBe("config");
  });

  it("should extract source from subscript access: config['key']", () => {
    const root = parse_js("const handler = config['key'];");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBe("config");
  });

  it("should return undefined for plain assignment: const x = 42", () => {
    const root = parse_js("const x = 42;");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBeUndefined();
  });

  it("should return undefined for plain function call: const x = foo()", () => {
    const root = parse_js("const x = foo();");
    const declarator = find_node_by_type(root, "variable_declarator")!;
    const name_node = declarator.childForFieldName("name")!;
    const result = extract_collection_source(name_node);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Containing Class
// ============================================================================

describe("find_containing_class", () => {
  it("should return class SymbolId for method inside class", () => {
    const root = parse_js("class MyClass { doStuff() {} }");
    const method_node = find_node_by_type(root, "method_definition")!;
    const name_node = method_node.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.method", SemanticCategory.DEFINITION, SemanticEntity.METHOD);
    const result = find_containing_class(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^class:.*:MyClass$/);
  });

  it("should return undefined for function not inside a class", () => {
    const root = parse_js("function standalone() {}");
    const func_node = find_node_by_type(root, "function_declaration")!;
    const name_node = func_node.childForFieldName("name")!;
    const capture = make_capture(name_node, "definition.function", SemanticCategory.DEFINITION, SemanticEntity.FUNCTION);
    const result = find_containing_class(capture);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Containing Callable
// ============================================================================

describe("find_containing_callable with anonymous functions", () => {
  it("should return matching SymbolId for arrow function parameters", () => {
    const code = "const fn = (x) => x * 2;";
    const root = parse_js(code);

    const param_node = find_arrow_function_param(root, "x");
    expect(param_node).not.toBeNull();

    const arrow_node = find_arrow_function(root);
    expect(arrow_node).not.toBeNull();

    const capture: CaptureNode = {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      node: param_node!,
      text: "x" as SymbolName,
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    const callable_id = find_containing_callable(capture);
    const expected_id = anonymous_function_symbol(node_to_location(arrow_node!, file_path));
    expect(callable_id).toBe(expected_id);
  });

  it("should return matching SymbolId for callback arrow function parameters", () => {
    const code = "items.reduce((acc, item) => acc + item, 0);";
    const root = parse_js(code);

    const param_node = find_arrow_function_param(root, "acc");
    expect(param_node).not.toBeNull();

    const arrow_node = find_arrow_function(root);
    expect(arrow_node).not.toBeNull();

    const capture: CaptureNode = {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      node: param_node!,
      text: "acc" as SymbolName,
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    const callable_id = find_containing_callable(capture);
    const expected_id = anonymous_function_symbol(node_to_location(arrow_node!, file_path));
    expect(callable_id).toBe(expected_id);
  });

  it("should return named function symbol for param inside named function", () => {
    const root = parse_js("function greet(name) { return name; }");
    const params = find_node_by_type(root, "formal_parameters")!;
    const param_node = find_node_by_type(params, "identifier")!;
    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const callable_id = find_containing_callable(capture);
    expect(callable_id).toMatch(/^function:.*:greet$/);
  });

  it("should return method symbol for param inside method", () => {
    const root = parse_js("class Foo { bar(x) {} }");
    const params = find_node_by_type(root, "formal_parameters")!;
    const param_node = find_node_by_type(params, "identifier")!;
    const capture = make_capture(param_node, "definition.parameter", SemanticCategory.DEFINITION, SemanticEntity.PARAMETER);
    const callable_id = find_containing_callable(capture);
    expect(callable_id).toMatch(/^method:.*:bar$/);
  });
});

// ============================================================================
// Callback Detection
// ============================================================================

describe("detect_callback_context", () => {
  it("should detect arrow function as callback in call arguments", () => {
    const root = parse_js("items.map((x) => x + 1);");
    const arrow_node = find_arrow_function(root)!;
    const result = detect_callback_context(arrow_node, file_path);
    expect(result.is_callback).toBe(true);
    expect(result.receiver_location).not.toBeNull();
  });

  it("should detect arrow function as callback in standalone call", () => {
    const root = parse_js("setTimeout(() => {}, 100);");
    const arrow_node = find_arrow_function(root)!;
    const result = detect_callback_context(arrow_node, file_path);
    expect(result.is_callback).toBe(true);
  });

  it("should not detect standalone arrow function as callback", () => {
    const root = parse_js("const fn = (x) => x + 1;");
    const arrow_node = find_arrow_function(root)!;
    const result = detect_callback_context(arrow_node, file_path);
    expect(result.is_callback).toBe(false);
    expect(result.receiver_location).toBeNull();
  });
});

