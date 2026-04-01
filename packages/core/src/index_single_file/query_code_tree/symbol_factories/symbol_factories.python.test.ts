/**
 * Tests for Python symbol factories
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
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
  store_python_docstring,
  consume_python_docstring,
  reset_documentation_state,
  clean_python_docstring,
} from "./symbol_factories.python";
import {
  anonymous_function_symbol,
  class_symbol,
  function_symbol,
  method_symbol,
  variable_symbol,
  parameter_symbol,
  property_symbol,
  interface_symbol,
  type_symbol,
  enum_symbol,
} from "@ariadnejs/types";
import type { FilePath, SymbolName, SymbolId } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "../../../index_single_file";

// ============================================================================
// Helpers
// ============================================================================

function parse_python(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(code);
  return tree.rootNode;
}

const file_path = "/test.py" as FilePath;

/** Build a CaptureNode from a tree-sitter node. */
function make_capture(
  node: SyntaxNode,
  opts: {
    name?: string;
    category?: SemanticCategory;
    entity?: SemanticEntity;
  } = {},
): CaptureNode {
  return {
    node,
    text: node.text as SymbolName,
    name: opts.name ?? "definition.function",
    category: opts.category ?? SemanticCategory.DEFINITION,
    entity: opts.entity ?? SemanticEntity.FUNCTION,
    location: {
      file_path,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column + 1,
    },
  };
}

/** DFS to find first node matching a predicate. */
function find_node(root: SyntaxNode, predicate: (n: SyntaxNode) => boolean): SyntaxNode | null {
  if (predicate(root)) return root;
  for (let i = 0; i < root.childCount; i++) {
    const result = find_node(root.child(i)!, predicate);
    if (result) return result;
  }
  return null;
}

/** Find an identifier node by name. */
function find_identifier(root: SyntaxNode, name: string): SyntaxNode | null {
  return find_node(root, (n) => n.type === "identifier" && n.text === name);
}

/** Find the name node of a function_definition. */
function find_function_name_node(root: SyntaxNode, fn_name: string): SyntaxNode | null {
  return find_node(root, (n) => {
    if (n.type === "function_definition") {
      const name_node = n.childForFieldName?.("name");
      return name_node?.text === fn_name;
    }
    return false;
  })?.childForFieldName?.("name") ?? null;
}

/** Find a function_definition node by its name. */
function find_function_def(root: SyntaxNode, fn_name: string): SyntaxNode | null {
  return find_node(root, (n) => {
    if (n.type === "function_definition") {
      const name_node = n.childForFieldName?.("name");
      return name_node?.text === fn_name;
    }
    return false;
  });
}

/** Find a class_definition node. */
function find_class_node(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "class_definition");
}

/** Find the lambda node. */
function find_lambda(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "lambda");
}

/** Find a parameter inside a lambda. */
function find_lambda_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  const lambda = find_lambda(root);
  if (!lambda) return null;
  const params = lambda.childForFieldName?.("parameters");
  if (!params) return null;
  return find_node(params, (n) => n.type === "identifier" && n.text === param_name);
}

/** Find a decorator node (the node of type "decorator"). */
function find_decorator(root: SyntaxNode, decorator_name: string): SyntaxNode | null {
  return find_node(root, (n) => {
    if (n.type === "decorator") {
      return n.children.some((c) => c.type === "identifier" && c.text === decorator_name);
    }
    return false;
  });
}

/** Find an import_from_statement node. */
function find_import_from(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "import_from_statement");
}

/** Find an import_statement node. */
function find_import(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "import_statement");
}

/** Find an assignment node. */
function find_assignment(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "assignment");
}

/** Find a string node (for docstrings). */
function find_string_node(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "string");
}

// ============================================================================
// create_*_id functions
// ============================================================================

describe("create_class_id", () => {
  it("should produce class:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("class MyClass:\n  pass");
    const class_def = find_class_node(root)!;
    const name_node = class_def.childForFieldName?.("name")!;
    const capture = make_capture(name_node, {
      name: "definition.class",
      entity: SemanticEntity.CLASS,
    });

    const result = create_class_id(capture);
    const expected = class_symbol("MyClass" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^class:\/test\.py:\d+:\d+:\d+:\d+:MyClass$/);
  });
});

describe("create_method_id", () => {
  it("should produce method:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("class Foo:\n  def bar(self):\n    pass");
    const name_node = find_function_name_node(root, "bar")!;
    const capture = make_capture(name_node, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = create_method_id(capture);
    const expected = method_symbol("bar" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^method:\/test\.py:\d+:\d+:\d+:\d+:bar$/);
  });
});

describe("create_function_id", () => {
  it("should produce function:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("def greet():\n  pass");
    const name_node = find_function_name_node(root, "greet")!;
    const capture = make_capture(name_node);

    const result = create_function_id(capture);
    const expected = function_symbol("greet" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^function:\/test\.py:\d+:\d+:\d+:\d+:greet$/);
  });
});

describe("create_variable_id", () => {
  it("should produce variable:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("x = 42");
    const name_node = find_identifier(root, "x")!;
    const capture = make_capture(name_node, {
      name: "definition.variable",
      entity: SemanticEntity.VARIABLE,
    });

    const result = create_variable_id(capture);
    const expected = variable_symbol("x" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^variable:\/test\.py:\d+:\d+:\d+:\d+:x$/);
  });
});

describe("create_parameter_id", () => {
  it("should produce parameter:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("def foo(bar):\n  pass");
    const name_node = find_identifier(root, "bar")!;
    const capture = make_capture(name_node, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const result = create_parameter_id(capture);
    const expected = parameter_symbol("bar" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^parameter:\/test\.py:\d+:\d+:\d+:\d+:bar$/);
  });
});

describe("create_property_id", () => {
  it("should produce property:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("class Foo:\n  x: int = 5");
    const name_node = find_identifier(root, "x")!;
    const capture = make_capture(name_node, {
      name: "definition.property",
      entity: SemanticEntity.PROPERTY,
    });

    const result = create_property_id(capture);
    const expected = property_symbol("x" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^property:\/test\.py:\d+:\d+:\d+:\d+:x$/);
  });
});

describe("create_enum_id", () => {
  it("should produce enum:<file>:<loc>:<name> SymbolId matching enum_symbol() output", () => {
    const root = parse_python("class Color(Enum):\n  RED = 1");
    const class_def = find_class_node(root)!;
    const name_node = class_def.childForFieldName?.("name")!;
    const capture = make_capture(name_node, {
      name: "definition.enum",
      entity: SemanticEntity.ENUM,
    });

    const result = create_enum_id(capture);

    // Verify create_enum_id delegates to enum_symbol() and produces the correct format.
    const expected = enum_symbol("Color" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^enum:\/test\.py:\d+:\d+:\d+:\d+:Color$/);
  });
});

describe("create_enum_member_id", () => {
  it("should append member name to enum SymbolId", () => {
    const enum_id = "enum:/test.py:1:7:1:12:Color" as SymbolId;
    const result = create_enum_member_id("RED", enum_id);
    expect(result).toBe("enum:/test.py:1:7:1:12:Color:RED");
  });
});

describe("create_protocol_id", () => {
  it("should produce interface:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("class Drawable(Protocol):\n  def draw(self): ...");
    const class_def = find_class_node(root)!;
    const name_node = class_def.childForFieldName?.("name")!;
    const capture = make_capture(name_node, {
      name: "definition.interface",
      entity: SemanticEntity.INTERFACE,
    });

    const result = create_protocol_id(capture);
    const expected = interface_symbol("Drawable" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^interface:\/test\.py:\d+:\d+:\d+:\d+:Drawable$/);
  });
});

describe("create_type_alias_id", () => {
  it("should produce type:<file>:<loc>:<name> SymbolId", () => {
    const root = parse_python("type Alias = int | str");
    // type_alias_statement has the name as an identifier child
    const name_node = find_identifier(root, "Alias")!;
    const capture = make_capture(name_node, {
      name: "definition.type_alias",
      entity: SemanticEntity.TYPE_ALIAS,
    });

    const result = create_type_alias_id(capture);
    const expected = type_symbol("Alias" as SymbolName, capture.location);
    expect(result).toBe(expected);
    expect(result).toMatch(/^type:\/test\.py:\d+:\d+:\d+:\d+:Alias$/);
  });
});

// ============================================================================
// Container finders
// ============================================================================

describe("find_containing_class", () => {
  it("should return class SymbolId for a method inside a class", () => {
    const root = parse_python("class MyClass:\n  def method(self):\n    pass");
    const method_name = find_function_name_node(root, "method")!;
    const capture = make_capture(method_name, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_class(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^class:\/test\.py:\d+:\d+:\d+:\d+:MyClass$/);
  });

  it("should return undefined for a top-level function", () => {
    const root = parse_python("def standalone():\n  pass");
    const name_node = find_function_name_node(root, "standalone")!;
    const capture = make_capture(name_node);

    const result = find_containing_class(capture);
    expect(result).toBeUndefined();
  });
});

describe("find_containing_enum", () => {
  it("should return enum SymbolId for a member inside an Enum class", () => {
    const root = parse_python("class Color(Enum):\n  RED = 1");
    const member_node = find_identifier(root, "RED")!;
    const capture = make_capture(member_node, {
      name: "definition.enum_member",
      entity: SemanticEntity.ENUM_MEMBER,
    });

    const result = find_containing_enum(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^enum:\/test\.py:\d+:\d+:\d+:\d+:Color$/);
  });

  it("should return enum SymbolId for IntEnum subclass", () => {
    const root = parse_python("class Status(IntEnum):\n  OK = 200");
    const member_node = find_identifier(root, "OK")!;
    const capture = make_capture(member_node, {
      name: "definition.enum_member",
      entity: SemanticEntity.ENUM_MEMBER,
    });

    const result = find_containing_enum(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^enum:\/test\.py:\d+:\d+:\d+:\d+:Status$/);
  });

  it("should return undefined for a regular class (not Enum)", () => {
    const root = parse_python("class MyClass:\n  x = 1");
    const member_node = find_identifier(root, "x")!;
    const capture = make_capture(member_node);

    const result = find_containing_enum(capture);
    expect(result).toBeUndefined();
  });
});

describe("find_containing_protocol", () => {
  it("should return interface SymbolId for a method inside a Protocol class", () => {
    const root = parse_python("class Drawable(Protocol):\n  def draw(self) -> None: ...");
    const method_name = find_function_name_node(root, "draw")!;
    const capture = make_capture(method_name, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_protocol(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^interface:\/test\.py:\d+:\d+:\d+:\d+:Drawable$/);
  });

  it("should return undefined for a regular class (not Protocol)", () => {
    const root = parse_python("class MyClass:\n  def method(self): pass");
    const method_name = find_function_name_node(root, "method")!;
    const capture = make_capture(method_name, {
      name: "definition.method",
      entity: SemanticEntity.METHOD,
    });

    const result = find_containing_protocol(capture);
    expect(result).toBeUndefined();
  });
});

describe("find_containing_callable", () => {
  it("should return function SymbolId for parameter in top-level function", () => {
    const root = parse_python("def foo(x):\n  pass");
    const param_node = find_identifier(root, "x")!;
    const capture = make_capture(param_node, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const result = find_containing_callable(capture);
    const name_node = find_function_name_node(root, "foo")!;
    const expected = function_symbol(
      "foo" as SymbolName,
      node_to_location(name_node, file_path),
    );
    expect(result).toBe(expected);
  });

  it("should return method SymbolId for parameter in class method", () => {
    const root = parse_python("class C:\n  def bar(self, y):\n    pass");
    const param_node = find_identifier(root, "y")!;
    const capture = make_capture(param_node, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const result = find_containing_callable(capture);
    const name_node = find_function_name_node(root, "bar")!;
    const expected = method_symbol(
      "bar" as SymbolName,
      node_to_location(name_node, file_path),
    );
    expect(result).toBe(expected);
  });

  it("should return anonymous_function_symbol for lambda parameters", () => {
    const code = "fn = lambda x: x * 2";
    const root = parse_python(code);
    const param_node = find_lambda_param(root, "x")!;
    const lambda_node = find_lambda(root)!;

    const capture = make_capture(param_node, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const result = find_containing_callable(capture);
    const expected = anonymous_function_symbol(node_to_location(lambda_node, file_path));
    expect(result).toBe(expected);
  });

  it("should return anonymous_function_symbol for callback lambda parameters", () => {
    const code = "result = reduce(lambda acc, item: acc + item, items, 0)";
    const root = parse_python(code);
    const param_node = find_lambda_param(root, "acc")!;
    const lambda_node = find_lambda(root)!;

    const capture = make_capture(param_node, {
      name: "definition.parameter",
      entity: SemanticEntity.PARAMETER,
    });

    const result = find_containing_callable(capture);
    const expected = anonymous_function_symbol(node_to_location(lambda_node, file_path));
    expect(result).toBe(expected);
  });
});

// ============================================================================
// find_decorator_target
// ============================================================================

describe("find_decorator_target", () => {
  it("should return function SymbolId for @decorator on top-level function", () => {
    const code = "@my_decorator\ndef greet():\n  pass";
    const root = parse_python(code);
    const dec = find_decorator(root, "my_decorator")!;
    // The capture node is built from the decorator identifier
    const dec_id = dec.children.find((c) => c.type === "identifier")!;
    const capture = make_capture(dec_id, {
      name: "decorator.function",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.FUNCTION,
    });

    const result = find_decorator_target(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^function:\/test\.py:\d+:\d+:\d+:\d+:greet$/);
  });

  it("should return class SymbolId for @decorator on class", () => {
    const code = "@my_decorator\nclass Foo:\n  pass";
    const root = parse_python(code);
    const dec = find_decorator(root, "my_decorator")!;
    const dec_id = dec.children.find((c) => c.type === "identifier")!;
    const capture = make_capture(dec_id, {
      name: "decorator.class",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.CLASS,
    });

    const result = find_decorator_target(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^class:\/test\.py:\d+:\d+:\d+:\d+:Foo$/);
  });

  it("should return property SymbolId for @property decorator on method", () => {
    const code = "class Foo:\n  @property\n  def name(self):\n    return self._name";
    const root = parse_python(code);
    const dec = find_decorator(root, "property")!;
    const dec_id = dec.children.find((c) => c.type === "identifier")!;
    const capture = make_capture(dec_id, {
      name: "decorator.method",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.METHOD,
    });

    const result = find_decorator_target(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^property:\/test\.py:\d+:\d+:\d+:\d+:name$/);
  });

  it("should return method SymbolId for non-property decorator on class method", () => {
    const code = "class Foo:\n  @my_decorator\n  def method(self):\n    pass";
    const root = parse_python(code);
    const dec = find_decorator(root, "my_decorator")!;
    const dec_id = dec.children.find((c) => c.type === "identifier")!;
    const capture = make_capture(dec_id, {
      name: "decorator.method",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.METHOD,
    });

    const result = find_decorator_target(capture);
    expect(result).toBeDefined();
    expect(result).toMatch(/^method:\/test\.py:\d+:\d+:\d+:\d+:method$/);
  });
});

// ============================================================================
// Type extraction
// ============================================================================

describe("extract_return_type", () => {
  it("should extract return type annotation from function", () => {
    const root = parse_python("def foo() -> int:\n  return 0");
    const func_def = find_function_def(root, "foo")!;

    const result = extract_return_type(func_def);
    expect(result).toBe("int");
  });

  it("should return undefined when no return type", () => {
    const root = parse_python("def foo():\n  pass");
    const func_def = find_function_def(root, "foo")!;

    const result = extract_return_type(func_def);
    expect(result).toBeUndefined();
  });

  it("should extract complex return type", () => {
    const root = parse_python("def foo() -> list[int]:\n  return []");
    const func_def = find_function_def(root, "foo")!;

    const result = extract_return_type(func_def);
    expect(result).toContain("list");
  });
});

describe("extract_parameter_type", () => {
  it("should extract type annotation for typed parameter", () => {
    const code = "def foo(x: int):\n  pass";
    const root = parse_python(code);
    // Find the identifier 'x' which is inside typed_parameter
    const x_node = find_identifier(root, "x")!;

    const result = extract_parameter_type(x_node);
    expect(result).toBe("int");
  });

  it("should return undefined for untyped parameter", () => {
    const code = "def foo(x):\n  pass";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_parameter_type(x_node);
    expect(result).toBeUndefined();
  });

  it("should extract type for typed_default_parameter", () => {
    const code = "def foo(x: int = 5):\n  pass";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_parameter_type(x_node);
    expect(result).toBe("int");
  });
});

describe("extract_property_type", () => {
  it("should extract type from annotated assignment in class", () => {
    const code = "class Foo:\n  x: int = 5";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_property_type(x_node);
    expect(result).toBe("int");
  });
});

describe("extract_type_annotation", () => {
  it("should extract type annotation from variable assignment", () => {
    const code = "x: int = 5";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_type_annotation(x_node);
    expect(result).toBe("int");
  });

  it("should return undefined when no annotation", () => {
    const code = "x = 5";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_type_annotation(x_node);
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Value extraction
// ============================================================================

describe("extract_default_value", () => {
  it("should extract default value from default_parameter node", () => {
    const code = "def foo(x=42):\n  pass";
    const root = parse_python(code);
    const default_param = find_node(root, (n) => n.type === "default_parameter")!;

    const result = extract_default_value(default_param);
    expect(result).toBe("42");
  });

  it("should extract default value from identifier inside default_parameter", () => {
    const code = "def foo(x=42):\n  pass";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_default_value(x_node);
    expect(result).toBe("42");
  });

  it("should extract string default value", () => {
    const code = "def foo(name='world'):\n  pass";
    const root = parse_python(code);
    const name_node = find_identifier(root, "name")!;

    const result = extract_default_value(name_node);
    expect(result).toBe("'world'");
  });

  it("should extract default value from typed_default_parameter", () => {
    const code = "def foo(x: int = 42):\n  pass";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_default_value(x_node);
    expect(result).toBe("42");
  });

  it("should return undefined when no default", () => {
    const code = "def foo(x):\n  pass";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_default_value(x_node);
    expect(result).toBeUndefined();
  });
});

describe("extract_initial_value", () => {
  it("should extract right-hand side of assignment", () => {
    const code = "x = 42";
    const root = parse_python(code);
    const x_node = find_identifier(root, "x")!;

    const result = extract_initial_value(x_node);
    expect(result).toBe("42");
  });

  it("should extract string initial value", () => {
    const code = "name = \"hello\"";
    const root = parse_python(code);
    const name_node = find_identifier(root, "name")!;

    const result = extract_initial_value(name_node);
    expect(result).toBe("\"hello\"");
  });
});

// ============================================================================
// Async / method type
// ============================================================================

describe("is_async_function", () => {
  it("should return true for async def", () => {
    const code = "async def fetch():\n  pass";
    const root = parse_python(code);
    const func_def = find_function_def(root, "fetch")!;

    expect(is_async_function(func_def)).toBe(true);
  });

  it("should return false for regular def", () => {
    const code = "def sync_fn():\n  pass";
    const root = parse_python(code);
    const func_def = find_function_def(root, "sync_fn")!;

    expect(is_async_function(func_def)).toBe(false);
  });
});

describe("determine_method_type", () => {
  it("should detect @staticmethod", () => {
    const code = "class Foo:\n  @staticmethod\n  def bar():\n    pass";
    const root = parse_python(code);
    const func_def = find_function_def(root, "bar")!;

    const result = determine_method_type(func_def);
    expect(result).toEqual({ static: true });
  });

  it("should detect @classmethod", () => {
    const code = "class Foo:\n  @classmethod\n  def create(cls):\n    pass";
    const root = parse_python(code);
    const func_def = find_function_def(root, "create")!;

    const result = determine_method_type(func_def);
    expect(result).toEqual({ abstract: true });
  });

  it("should return empty object for regular method", () => {
    const code = "class Foo:\n  def method(self):\n    pass";
    const root = parse_python(code);
    const func_def = find_function_def(root, "method")!;

    const result = determine_method_type(func_def);
    expect(result).toEqual({});
  });
});

// ============================================================================
// Import path extraction
// ============================================================================

describe("extract_import_path", () => {
  it("should extract module path from 'from foo.bar import baz'", () => {
    const code = "from foo.bar import baz";
    const root = parse_python(code);
    const import_node = find_import_from(root)!;

    const result = extract_import_path(import_node);
    expect(result).toBe("foo.bar");
  });

  it("should extract module path from 'import os.path'", () => {
    const code = "import os.path";
    const root = parse_python(code);
    const import_node = find_import(root)!;

    const result = extract_import_path(import_node);
    expect(result).toBe("os.path");
  });

  it("should extract relative import path", () => {
    const code = "from . import utils";
    const root = parse_python(code);
    const import_node = find_import_from(root)!;

    const result = extract_import_path(import_node);
    // Relative imports have "." as module_name
    expect(result).toBe(".");
  });
});

// ============================================================================
// Export info (kept from original — these are already behavioral)
// ============================================================================

describe("extract_export_info (Python visibility via naming conventions)", () => {
  const MODULE_SCOPE_ID = "scope:module" as import("@ariadnejs/types").ScopeId;

  it("should mark public functions as exported at module level", () => {
    const result = extract_export_info("public_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark single underscore private functions as not exported", () => {
    const result = extract_export_info("_private_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });

  it("should mark double underscore private functions as not exported", () => {
    const result = extract_export_info("__private_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });

  it("should mark dunder methods (__init__) as exported at module level", () => {
    const result = extract_export_info("__init__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark other dunder methods (__str__) as exported at module level", () => {
    const result = extract_export_info("__str__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark __eq__ dunder method as exported at module level", () => {
    const result = extract_export_info("__eq__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark nested functions as not exported", () => {
    const NESTED_SCOPE_ID = "scope:nested" as import("@ariadnejs/types").ScopeId;
    const result = extract_export_info("helper", NESTED_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });
});

// ============================================================================
// Callback detection (kept from original — these are already behavioral)
// ============================================================================

describe("detect_callback_context", () => {
  describe("direct function call patterns", () => {
    it("should detect callback in map(lambda x: ...)", () => {
      const code = "result = list(map(lambda x: x * 2, items))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
      expect(result.receiver_location?.start_line).toBe(1);
    });

    it("should detect callback in filter(lambda x: ...)", () => {
      const code = "result = list(filter(lambda x: x > 0, items))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in sorted(key=lambda x: ...)", () => {
      const code = "result = sorted(items, key=lambda x: x.value)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in reduce(lambda acc, x: ..., items, init)", () => {
      const code = "result = reduce(lambda acc, x: acc + x, items, 0)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("method chaining patterns", () => {
    it("should detect callback in df.apply(lambda x: ...)", () => {
      const code = "result = df.apply(lambda x: x * 2)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in df.groupby().apply(lambda...)", () => {
      const code = "result = df.groupby('col').apply(lambda rows: list(rows))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("dictionary unpacking pattern", () => {
    it("should detect callback in df.assign(**{key: lambda...})", () => {
      const code = "result = df.assign(**{_COL: lambda df: df[_COL].apply(str)})";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
      expect(result.receiver_location?.start_column).toBe(10);
    });

    it("should detect callback in func(**{key: lambda...}) with variable key", () => {
      const code = "_END_DATE_COL = 'end_date'\nresult = df.assign(**{_END_DATE_COL: lambda df: df.apply(str)})";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("factory function pattern", () => {
    it("should detect callback in defaultdict(lambda: ...)", () => {
      const code = "dd = defaultdict(lambda: defaultdict(int))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in defaultdict(lambda: [])", () => {
      const code = "result = defaultdict(lambda: [])";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(true);
    });
  });

  describe("negative cases", () => {
    it("should NOT detect callback for standalone lambda assignment", () => {
      const code = "fn = lambda x: x * 2";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(false);
      expect(result.receiver_location).toBeNull();
    });

    it("should NOT detect callback for lambda in list literal (not in call)", () => {
      const code = "handlers = [lambda x: x, lambda y: y * 2]";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for lambda in dict literal (not in call)", () => {
      const code = "config = {'handler': lambda x: x}";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for lambda in tuple literal", () => {
      const code = "pair = (lambda x: x, lambda y: y)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root)!;

      const result = detect_callback_context(lambda_node, file_path);
      expect(result.is_callback).toBe(false);
    });
  });
});

// ============================================================================
// extract_extends (kept from original — already behavioral)
// ============================================================================

describe("extract_extends", () => {
  it("should extract simple base class", () => {
    const root = parse_python("class Foo(Bar):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["Bar"]);
  });

  it("should extract generic base class: class Foo(Bar[T])", () => {
    const root = parse_python("class Foo(Bar[T]):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["Bar"]);
  });

  it("should extract module-qualified generic base class: class Foo(mod.Bar[T])", () => {
    const root = parse_python("class Foo(mod.Bar[T]):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["mod.Bar"]);
  });

  it("should extract multiple generic base classes: class Foo(Bar[T], Baz[U])", () => {
    const root = parse_python("class Foo(Bar[T], Baz[U]):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["Bar", "Baz"]);
  });

  it("should extract mix of simple and generic base classes", () => {
    const root = parse_python("class Foo(Bar, Baz[T]):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["Bar", "Baz"]);
  });

  it("should extract generic base with multiple type params: class Foo(Dict[K, V])", () => {
    const root = parse_python("class Foo(Dict[K, V]):\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual(["Dict"]);
  });

  it("should return empty array for class without bases", () => {
    const root = parse_python("class Foo:\n  pass");
    const class_node = find_class_node(root)!;
    expect(extract_extends(class_node)).toEqual([]);
  });
});

// ============================================================================
// Function collection detection
// ============================================================================

describe("detect_function_collection", () => {
  it("should detect list of function references", () => {
    const code = "handlers = [fn1, fn2, fn3]";
    const root = parse_python(code);
    const assignment = find_assignment(root)!;

    const result = detect_function_collection(assignment, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_references).toEqual(["fn1", "fn2", "fn3"]);
  });

  it("should detect dict of function references", () => {
    const code = "config = {\"success\": handle_success, \"error\": handle_error}";
    const root = parse_python(code);
    const assignment = find_assignment(root)!;

    const result = detect_function_collection(assignment, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Object");
    expect(result!.stored_references).toEqual(["handle_success", "handle_error"]);
  });

  it("should detect tuple of function references", () => {
    const code = "callbacks = (on_start, on_end)";
    const root = parse_python(code);
    const assignment = find_assignment(root)!;

    const result = detect_function_collection(assignment, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_references).toEqual(["on_start", "on_end"]);
  });

  it("should return null for non-collection assignment", () => {
    const code = "x = 42";
    const root = parse_python(code);
    const assignment = find_assignment(root)!;

    const result = detect_function_collection(assignment, file_path);
    expect(result).toBeNull();
  });

  it("should detect lambda in list", () => {
    const code = "handlers = [lambda x: x]";
    const root = parse_python(code);
    const assignment = find_assignment(root)!;

    const result = detect_function_collection(assignment, file_path);
    expect(result).not.toBeNull();
    expect(result!.collection_type).toBe("Array");
    expect(result!.stored_functions.length).toBe(1);
  });
});

// ============================================================================
// Docstring management
// ============================================================================

describe("clean_python_docstring", () => {
  it("should strip triple double quotes from single-line docstring", () => {
    expect(clean_python_docstring("\"\"\"Hello\"\"\"")).toBe("Hello");
  });

  it("should strip triple single quotes from single-line docstring", () => {
    expect(clean_python_docstring("'''Hello'''")).toBe("Hello");
  });

  it("should strip and dedent multi-line docstring", () => {
    const raw = "\"\"\"\n  Hello\n  World\n\"\"\"";
    expect(clean_python_docstring(raw)).toBe("Hello\nWorld");
  });

  it("should handle empty docstring", () => {
    expect(clean_python_docstring("\"\"\"\"\"\"")).toBe("");
  });

  it("should handle docstring with varying indentation", () => {
    const raw = "\"\"\"\n    First line\n      Indented\n    Back\n\"\"\"";
    expect(clean_python_docstring(raw)).toBe("First line\n  Indented\nBack");
  });
});

describe("store_python_docstring / consume_python_docstring / reset_documentation_state", () => {
  beforeEach(() => {
    reset_documentation_state();
  });

  it("should store and consume a docstring keyed by definition start line", () => {
    const code = "def foo():\n  \"\"\"A docstring.\"\"\"\n  pass";
    const root = parse_python(code);

    // Find the string node (the docstring)
    const string_node = find_string_node(root)!;
    expect(string_node).not.toBeNull();

    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);

    // The function_definition starts at line 1
    const consumed = consume_python_docstring(1);
    expect(consumed).toBe("A docstring.");
  });

  it("should return undefined when consuming a non-existent docstring", () => {
    const result = consume_python_docstring(999);
    expect(result).toBeUndefined();
  });

  it("should consume only once (second call returns undefined)", () => {
    const code = "def bar():\n  \"\"\"Doc.\"\"\"\n  pass";
    const root = parse_python(code);
    const string_node = find_string_node(root)!;
    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);

    const first = consume_python_docstring(1);
    expect(first).toBe("Doc.");

    const second = consume_python_docstring(1);
    expect(second).toBeUndefined();
  });

  it("should clear all stored docstrings on reset", () => {
    const code = "def baz():\n  \"\"\"Baz doc.\"\"\"\n  pass";
    const root = parse_python(code);
    const string_node = find_string_node(root)!;
    const capture = make_capture(string_node, {
      name: "definition.documentation",
      entity: SemanticEntity.DOCUMENTATION,
    });

    store_python_docstring(capture);
    reset_documentation_state();

    const result = consume_python_docstring(1);
    expect(result).toBeUndefined();
  });
});
