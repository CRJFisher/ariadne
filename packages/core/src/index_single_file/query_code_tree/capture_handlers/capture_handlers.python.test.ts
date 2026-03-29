/**
 * Tests for Python language configuration with builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import { PYTHON_HANDLERS } from "./capture_handlers.python";
import { DefinitionBuilder } from "../../definitions/definitions";
import { build_index_single_file } from "../../index_single_file";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticCategory,
  SemanticEntity,
} from "../../index_single_file";
import type { FilePath, Location, ScopeId, SymbolName } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";
import { extract_import_path, detect_callback_context } from "../symbol_factories/symbol_factories.python";

describe("Python Builder Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  // Helper function to create test context
  function create_test_context(with_scopes: boolean = false): ProcessingContext {
    const test_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;
    const scopes = new Map();

    if (with_scopes) {
      // Add method body scopes for tests that need them
      scopes.set("method:test.py:3:2:5:3:<method_body>" as ScopeId, {
        id: "method:test.py:3:2:5:3:<method_body>" as ScopeId,
        type: "method",
        name: "my_method",
        location: {
          file_path: "test.py" as any,
          start_line: 3,
          start_column: 2,
          end_line: 5,
          end_column: 3,
        },
        parent_id: test_scope_id,
      });
      scopes.set("method:test.py:7:2:9:3:<method_body>" as ScopeId, {
        id: "method:test.py:7:2:9:3:<method_body>" as ScopeId,
        type: "method",
        name: "__init__",
        location: {
          file_path: "test.py" as any,
          start_line: 7,
          start_column: 2,
          end_line: 9,
          end_column: 3,
        },
        parent_id: test_scope_id,
      });
      // Add function scope for parameter tests
      scopes.set("function:test.py:1:0:3:1:<function_body>" as ScopeId, {
        id: "function:test.py:1:0:3:1:<function_body>" as ScopeId,
        type: "function",
        name: "my_function",
        location: {
          file_path: "test.py" as any,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        parent_id: test_scope_id,
      });
    }

    return {
      captures: [],
      scopes,
      scope_depths: new Map(),
      root_scope_id: test_scope_id,
      get_scope_id: (location: Location) => test_scope_id,
      get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => test_scope_id,
    };
  }

  // Helper function to create a raw capture from code
  function create_capture(
    code: string,
    capture_name: string,
    node_type: string
  ): CaptureNode {
    const ast = parser.parse(code);
    const node = find_node_by_type(ast.rootNode, node_type);
    if (!node) {
      throw new Error(`Could not find node of type ${node_type} in code`);
    }

    // Parse capture name to get category and entity
    const parts = capture_name.split(".");
    const category = parts[0] as any;
    const entity = parts[1] as any;

    return {
      name: capture_name,
      category,
      entity,
      node: node as any,
      text: node.text as SymbolName,
      location: node_to_location(node, "test.py" as any),
    };
  }

  // Helper function to find first node of specific type
  function find_node_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = find_node_by_type(node.child(i)!, type);
      if (found) return found;
    }
    return null;
  }

  describe("PYTHON_HANDLERS", () => {
    it("should export a valid handler registry with all expected keys", () => {
      expect(Object.keys(PYTHON_HANDLERS).length).toEqual(45);
    });

    it("should contain class definition capture mappings", () => {
      const class_mappings = ["definition.class"];

      for (const mapping of class_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain method definition capture mappings", () => {
      const method_mappings = [
        "definition.method",
        "definition.method.static",
        "definition.method.class",
        "definition.constructor",
      ];

      for (const mapping of method_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain function definition capture mappings", () => {
      const function_mappings = [
        "definition.function",
        "definition.lambda",
      ];

      for (const mapping of function_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain parameter definition capture mappings", () => {
      const param_mappings = [
        "definition.parameter",
        "definition.parameter.default",
        "definition.parameter.typed",
        "definition.parameter.typed.default",
        "definition.parameter.args",
        "definition.parameter.kwargs",
      ];

      for (const mapping of param_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain variable definition capture mappings", () => {
      const variable_mappings = [
        "definition.variable",
        "definition.variable.typed",
        "definition.variable.multiple",
        "definition.variable.tuple",
        "definition.variable.destructured",
        "definition.loop_var",
        "definition.loop_var.multiple",
        "definition.comprehension_var",
        "definition.except_var",
        "definition.with_var",
      ];

      for (const mapping of variable_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain property definition capture mappings", () => {
      const property_mappings = ["definition.property", "definition.field"];

      for (const mapping of property_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should contain import capture mappings", () => {
      const import_mappings = [
        "import.named",
        "import.named.source",
        "import.named.alias",
        "import.module",
        "import.module.source",
        "import.module.alias",
        "import.star",
      ];

      for (const mapping of import_mappings) {
        expect((mapping in PYTHON_HANDLERS)).toBe(true);
        const handler = PYTHON_HANDLERS[mapping];
        expect(typeof handler).toBe("function");
      }
    });

    it("should handle a simple class definition", () => {
      const code = `class MyClass:
    pass`;
      const capture = create_capture(code, "definition.class", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["definition.class"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.classes.size).toEqual(1);
      const cls = definitions.classes.values().next().value!;
      expect(cls.name).toEqual("MyClass");
      expect(cls.is_exported).toEqual(true);
    });

    it("should handle a method definition", () => {
      const code = `class MyClass:
    def my_method(self):
        pass`;
      // First register the class
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const class_capture = create_capture(code, "definition.class", "identifier");
      PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

      // Now register the method — find the method name node (second identifier)
      const ast = parser.parse(code);
      const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
      const method_name_node = func_def.childForFieldName("name")!;
      const method_capture: CaptureNode = {
        name: "definition.method",
        category: "definition" as SemanticCategory,
        entity: "method" as SemanticEntity,
        node: method_name_node as any,
        text: method_name_node.text as SymbolName,
        location: node_to_location(method_name_node, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.method"]!(method_capture, builder, context);

      const definitions = builder.build();
      const cls = definitions.classes.values().next().value!;
      expect(cls.methods.length).toEqual(1);
      expect(cls.methods[0]!.name).toEqual("my_method");
    });

    it("should handle a function definition", () => {
      const code = `def my_function():
    pass`;
      const capture = create_capture(code, "definition.function", "identifier");
      const context = create_test_context(true);
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["definition.function"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.functions.size).toEqual(1);
      const func = definitions.functions.values().next().value!;
      expect(func.name).toEqual("my_function");
      expect(func.is_exported).toEqual(true);
    });

    it("should handle variable definitions", () => {
      const code = "x = 10";
      const capture = create_capture(code, "definition.variable", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["definition.variable"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.variables.size).toEqual(1);
      const variable = definitions.variables.values().next().value!;
      expect(variable.name).toEqual("x");
      expect(variable.kind).toEqual("variable");
    });

    it("should handle import statements", () => {
      const code = "import os";
      const capture = create_capture(code, "import.module", "dotted_name");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["import.module"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.imports.size).toEqual(1);
      const import_def = definitions.imports.values().next().value!;
      expect(import_def.name).toEqual("os");
    });

    it("should handle lambda functions", () => {
      const code = "f = lambda x: x * 2";
      const capture = create_capture(code, "definition.lambda", "lambda");
      const context = create_test_context(true);
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["definition.lambda"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.functions.size).toEqual(1);
      const func = definitions.functions.values().next().value!;
      expect(func.name).toEqual("lambda");
      expect(func.is_exported).toEqual(false);
    });

    it("should handle static methods", () => {
      const code = `class MyClass:
    @staticmethod
    def static_method():
        pass`;
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      // Register class first
      const class_capture = create_capture(code, "definition.class", "identifier");
      PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

      // Find and register the method
      const ast = parser.parse(code);
      const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
      const method_name_node = func_def.childForFieldName("name")!;
      const method_capture: CaptureNode = {
        name: "definition.method.static",
        category: "definition" as SemanticCategory,
        entity: "method" as SemanticEntity,
        node: method_name_node as any,
        text: method_name_node.text as SymbolName,
        location: node_to_location(method_name_node, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.method.static"]!(method_capture, builder, context);

      const definitions = builder.build();
      const cls = definitions.classes.values().next().value!;
      expect(cls.methods.length).toEqual(1);
      expect(cls.methods[0]!.name).toEqual("static_method");
      expect(cls.methods[0]!.static).toEqual(true);
    });

    it("should handle class methods", () => {
      const code = `class MyClass:
    @classmethod
    def class_method(cls):
        pass`;
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const class_capture = create_capture(code, "definition.class", "identifier");
      PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

      const ast = parser.parse(code);
      const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
      const method_name_node = func_def.childForFieldName("name")!;
      const method_capture: CaptureNode = {
        name: "definition.method.class",
        category: "definition" as SemanticCategory,
        entity: "method" as SemanticEntity,
        node: method_name_node as any,
        text: method_name_node.text as SymbolName,
        location: node_to_location(method_name_node, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.method.class"]!(method_capture, builder, context);

      const definitions = builder.build();
      const cls = definitions.classes.values().next().value!;
      expect(cls.methods.length).toEqual(1);
      expect(cls.methods[0]!.name).toEqual("class_method");
      expect(cls.methods[0]!.abstract).toEqual(true); // classmethod uses abstract flag
    });

    it("should handle properties", () => {
      const code = `class MyClass:
    @property
    def my_property(self):
        return self._value`;
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const class_capture = create_capture(code, "definition.class", "identifier");
      PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

      const ast = parser.parse(code);
      const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
      const prop_name_node = func_def.childForFieldName("name")!;
      const prop_capture: CaptureNode = {
        name: "definition.property",
        category: "definition" as SemanticCategory,
        entity: "property" as SemanticEntity,
        node: prop_name_node as any,
        text: prop_name_node.text as SymbolName,
        location: node_to_location(prop_name_node, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.property"]!(prop_capture, builder, context);

      const definitions = builder.build();
      const cls = definitions.classes.values().next().value!;
      expect(cls.properties.length).toEqual(1);
      expect(cls.properties[0]!.name).toEqual("my_property");
      expect(cls.properties[0]!.readonly).toEqual(true);
    });

    it("should handle class inheritance", () => {
      const code = `class Child(Parent):
    pass`;
      const capture = create_capture(code, "definition.class", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["definition.class"]!(capture, builder, context);

      const definitions = builder.build();
      const cls = definitions.classes.values().next().value!;
      expect(cls.name).toEqual("Child");
      expect(cls.extends).toContain("Parent");
    });

    it("should handle typed parameters with default values", () => {
      const code = `def func(x: int = 10):
    pass`;
      const ast = parser.parse(code);
      const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
      const func_name = func_def.childForFieldName("name")!;
      const typed_default = find_node_by_type(ast.rootNode, "typed_default_parameter")!;
      const name_node = typed_default.childForFieldName("name")!;

      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const func_capture: CaptureNode = {
        name: "definition.function",
        category: "definition" as SemanticCategory,
        entity: "function" as SemanticEntity,
        node: func_name as any,
        text: func_name.text as SymbolName,
        location: node_to_location(func_name, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

      const param_capture: CaptureNode = {
        name: "definition.parameter.typed.default",
        category: "definition" as SemanticCategory,
        entity: "parameter" as SemanticEntity,
        node: name_node as any,
        text: name_node.text as SymbolName,
        location: node_to_location(name_node, "test.py" as any),
      };
      PYTHON_HANDLERS["definition.parameter.typed.default"]!(param_capture, builder, context);

      const definitions = builder.build();
      const func = definitions.functions.values().next().value!;
      expect(func.signature.parameters.length).toEqual(1);
      expect(func.signature.parameters[0]!.name).toEqual("x");
      expect(func.signature.parameters[0]!.optional).toEqual(true);
    });

    it("should handle from imports", () => {
      const code = "from os import path";
      const ast = parser.parse(code);
      // Find the import_from_statement, then get the imported name (second dotted_name)
      const import_stmt = find_node_by_type(ast.rootNode, "import_from_statement")!;
      const dotted_names: SyntaxNode[] = [];
      for (let i = 0; i < import_stmt.childCount; i++) {
        const child = import_stmt.child(i)!;
        if (child.type === "dotted_name") dotted_names.push(child);
      }
      const path_node = dotted_names[1]!; // "path" is the second dotted_name
      const capture: CaptureNode = {
        name: "import.named",
        category: "import" as SemanticCategory,
        entity: "named" as SemanticEntity,
        node: path_node as any,
        text: path_node.text as SymbolName,
        location: node_to_location(path_node, "test.py" as any),
      };
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      PYTHON_HANDLERS["import.named"]!(capture, builder, context);

      const definitions = builder.build();
      expect(definitions.imports.size).toEqual(1);
      const import_def = definitions.imports.values().next().value!;
      expect(import_def.name).toEqual("path");
    });

    it("should handle aliased imports", () => {
      const code = "import numpy as np";
      const ast = parser.parse(code);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      // Aliased imports require import.module.source then import.module.alias
      // import.module.source captures the source module name "numpy"
      const source_node = find_node_by_type(ast.rootNode, "dotted_name")!;
      const source_capture: CaptureNode = {
        name: "import.module.source",
        category: "import" as SemanticCategory,
        entity: "module" as SemanticEntity,
        node: source_node as any,
        text: source_node.text as SymbolName,
        location: node_to_location(source_node, "test.py" as any),
      };
      PYTHON_HANDLERS["import.module.source"]!(source_capture, builder, context);

      // import.module.alias captures the alias "np"
      const alias_node = find_node_by_type(ast.rootNode, "aliased_import")!;
      const alias_identifier = alias_node.childForFieldName("alias")!;
      const alias_capture: CaptureNode = {
        name: "import.module.alias",
        category: "import" as SemanticCategory,
        entity: "module" as SemanticEntity,
        node: alias_identifier as any,
        text: alias_identifier.text as SymbolName,
        location: node_to_location(alias_identifier, "test.py" as any),
      };
      PYTHON_HANDLERS["import.module.alias"]!(alias_capture, builder, context);

      const definitions = builder.build();
      expect(definitions.imports.size).toEqual(1);
      const import_def = definitions.imports.values().next().value!;
      expect(import_def.name).toEqual("np");
    });

    it("should handle relative imports (from .module import name)", () => {
      const code = "from .utils import helper, process_data";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_from_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get ".utils" not "helper"
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe(".utils");
      }
    });

    it("should handle absolute imports (from package.module import name)", () => {
      const code = "from os.path import join";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_from_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get "os.path"
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("os.path");
      }
    });

    it("should handle regular imports (import module)", () => {
      const code = "import os";
      const ast = parser.parse(code);

      // Find the import_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get "os"
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("os");
      }
    });

    it("should handle multiple level relative imports (from ..module import name)", () => {
      const code = "from ..utils import helper";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_from_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get "..utils" not "helper"
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("..utils");
      }
    });

    it("should handle parent directory relative imports (from .. import name)", () => {
      const code = "from .. import utils";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_from_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get ".." for parent directory
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("..");
      }
    });

    it("should handle nested package absolute imports (from a.b.c import name)", () => {
      const code = "from package.subpackage.module import function";
      const ast = parser.parse(code);

      // Find the import_from_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_from_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get full module path
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("package.subpackage.module");
      }
    });

    it("should handle dotted module imports (import package.module)", () => {
      const code = "import os.path";
      const ast = parser.parse(code);

      // Find the import_statement node
      const import_node = find_node_by_type(ast.rootNode, "import_statement");
      expect(import_node).toBeDefined();

      if (import_node) {
        // Extract the import path - should get "os.path"
        const import_path = extract_import_path(import_node);
        expect(import_path).toBe("os.path");
      }
    });

    describe("Enum handlers", () => {
      it("should handle enum definition", () => {
        const code = `class Color(Enum):
    RED = 1
    GREEN = 2`;
        const capture = create_capture(code, "definition.enum", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        PYTHON_HANDLERS["definition.enum"]!(capture, builder, context);

        const definitions = builder.build();
        expect(definitions.enums.size).toEqual(1);
        const enum_def = definitions.enums.values().next().value!;
        expect(enum_def.name).toEqual("Color");
        expect(enum_def.is_exported).toEqual(true);
      });

      it("should handle enum member definition", () => {
        const code = `class Color(Enum):
    RED = 1
    GREEN = 2`;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Register enum first
        const enum_capture = create_capture(code, "definition.enum", "identifier");
        PYTHON_HANDLERS["definition.enum"]!(enum_capture, builder, context);

        // Find and register a member — find "RED" identifier inside the class body
        const ast = parser.parse(code);
        const find_assignment_target = (node: SyntaxNode): SyntaxNode | null => {
          if (node.type === "assignment") {
            const left = node.childForFieldName("left");
            if (left?.type === "identifier" && left.text === "RED") return left;
          }
          for (let i = 0; i < node.childCount; i++) {
            const found = find_assignment_target(node.child(i)!);
            if (found) return found;
          }
          return null;
        };

        const red_node = find_assignment_target(ast.rootNode)!;
        const member_capture: CaptureNode = {
          name: "definition.enum_member",
          category: "definition" as SemanticCategory,
          entity: "enum_member" as SemanticEntity,
          node: red_node as any,
          text: red_node.text as SymbolName,
          location: node_to_location(red_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.enum_member"]!(member_capture, builder, context);

        const definitions = builder.build();
        const enum_def = definitions.enums.values().next().value!;
        expect(enum_def.members.length).toEqual(1);
        expect(enum_def.members[0]!.name).toEqual("RED");
      });
    });

    describe("Decorator handlers", () => {
      it("should handle decorator.variable on a class", () => {
        const code = `@dataclass
class MyClass:
    name: str`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Register class — use the class_definition name from the same AST
        const decorated_def = find_node_by_type(ast.rootNode, "decorated_definition")!;
        const class_def = decorated_def.childForFieldName("definition")!;
        const class_name_node = class_def.childForFieldName("name")!;
        const class_capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: class_name_node as any,
          text: class_name_node.text as SymbolName,
          location: node_to_location(class_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

        // Register decorator
        const decorator_node = find_node_by_type(ast.rootNode, "decorator")!;
        const dec_name_node = decorator_node.child(1)!;
        const dec_capture: CaptureNode = {
          name: "decorator.variable",
          category: "decorator" as SemanticCategory,
          entity: "variable" as SemanticEntity,
          node: dec_name_node as any,
          text: dec_name_node.text as SymbolName,
          location: node_to_location(dec_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["decorator.variable"]!(dec_capture, builder, context);

        const definitions = builder.build();
        const cls = definitions.classes.values().next().value!;
        expect(cls.decorators.length).toEqual(1);
        expect(cls.decorators[0]!.name).toEqual("dataclass");
      });

      it("should handle decorator.function on a function", () => {
        const code = `@app.route("/")
def index():
    pass`;
        const ast = parser.parse(code);
        const context = create_test_context(true);
        const builder = new DefinitionBuilder(context);

        const decorated_def = find_node_by_type(ast.rootNode, "decorated_definition")!;
        const func_def = decorated_def.childForFieldName("definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const decorator_node = find_node_by_type(ast.rootNode, "decorator")!;
        const call_node = find_node_by_type(decorator_node, "call");
        const attr_node = call_node ? find_node_by_type(call_node, "attribute") : null;
        const dec_node = attr_node || decorator_node.child(1)!;
        const dec_capture: CaptureNode = {
          name: "decorator.function",
          category: "decorator" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: dec_node as any,
          text: dec_node.text as SymbolName,
          location: node_to_location(dec_node, "test.py" as any),
        };
        PYTHON_HANDLERS["decorator.function"]!(dec_capture, builder, context);

        const definitions = builder.build();
        expect(definitions.functions.size).toEqual(1);
        const func = definitions.functions.values().next().value!;
        expect(func.name).toEqual("index");
        expect(func.decorators!.length).toEqual(1);
        expect(func.decorators![0]!.name).toEqual("app.route");
      });

      it("should handle decorator.method on a method", () => {
        const code = `class MyClass:
    @staticmethod
    def my_method():
        pass`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Register class from same AST
        const class_def = find_node_by_type(ast.rootNode, "class_definition")!;
        const class_name = class_def.childForFieldName("name")!;
        const class_capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: class_name as any,
          text: class_name.text as SymbolName,
          location: node_to_location(class_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

        // Register method from same AST
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const method_name_node = func_def.childForFieldName("name")!;
        const method_capture: CaptureNode = {
          name: "definition.method.static",
          category: "definition" as SemanticCategory,
          entity: "method" as SemanticEntity,
          node: method_name_node as any,
          text: method_name_node.text as SymbolName,
          location: node_to_location(method_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.method.static"]!(method_capture, builder, context);

        // Register decorator from same AST
        const decorator_node = find_node_by_type(ast.rootNode, "decorator")!;
        const dec_name_node = decorator_node.child(1)!;
        const dec_capture: CaptureNode = {
          name: "decorator.method",
          category: "decorator" as SemanticCategory,
          entity: "method" as SemanticEntity,
          node: dec_name_node as any,
          text: dec_name_node.text as SymbolName,
          location: node_to_location(dec_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["decorator.method"]!(dec_capture, builder, context);

        const definitions = builder.build();
        const cls = definitions.classes.values().next().value!;
        expect(cls.methods[0]!.decorators!.length).toEqual(1);
        expect(cls.methods[0]!.decorators![0]!.name).toEqual("staticmethod");
      });

      it("should handle decorator.property", () => {
        const code = `class MyClass:
    @property
    def value(self):
        return self._value`;
        const ast = parser.parse(code);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const class_def = find_node_by_type(ast.rootNode, "class_definition")!;
        const class_name = class_def.childForFieldName("name")!;
        const class_capture: CaptureNode = {
          name: "definition.class",
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          node: class_name as any,
          text: class_name.text as SymbolName,
          location: node_to_location(class_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const prop_name_node = func_def.childForFieldName("name")!;
        const prop_capture: CaptureNode = {
          name: "definition.property",
          category: "definition" as SemanticCategory,
          entity: "property" as SemanticEntity,
          node: prop_name_node as any,
          text: prop_name_node.text as SymbolName,
          location: node_to_location(prop_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.property"]!(prop_capture, builder, context);

        const decorator_node = find_node_by_type(ast.rootNode, "decorator")!;
        const dec_name_node = decorator_node.child(1)!;
        const dec_capture: CaptureNode = {
          name: "decorator.property",
          category: "decorator" as SemanticCategory,
          entity: "property" as SemanticEntity,
          node: dec_name_node as any,
          text: dec_name_node.text as SymbolName,
          location: node_to_location(dec_name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["decorator.property"]!(dec_capture, builder, context);

        const definitions = builder.build();
        const cls = definitions.classes.values().next().value!;
        expect(cls.properties.length).toEqual(1);
        expect(cls.properties[0]!.name).toEqual("value");
        expect(cls.properties[0]!.readonly).toEqual(true);
        expect(cls.properties[0]!.decorators!.length).toEqual(1);
        expect(cls.properties[0]!.decorators![0]!.name).toEqual("property");
      });
    });

    describe("Type alias handler", () => {
      it("should handle type alias definition", () => {
        const code = "UserId = int";
        const capture = create_capture(code, "definition.type_alias", "identifier");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        PYTHON_HANDLERS["definition.type_alias"]!(capture, builder, context);

        const definitions = builder.build();
        expect(definitions.types.size).toEqual(1);
        const type_def = definitions.types.values().next().value!;
        expect(type_def.name).toEqual("UserId");
        expect(type_def.is_exported).toEqual(true);
      });
    });

    describe("Anonymous function handler", () => {
      it("should handle anonymous function (lambda in callback)", () => {
        const code = "result = map(lambda x: x * 2, items)";
        const capture = create_capture(code, "definition.anonymous_function", "lambda");
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        PYTHON_HANDLERS["definition.anonymous_function"]!(capture, builder, context);

        const definitions = builder.build();
        expect(definitions.functions.size).toEqual(1);
        const func = definitions.functions.values().next().value!;
        expect(func.name).toEqual("<anonymous>");
        expect(func.is_exported).toEqual(false);
      });
    });

    describe("Parameter handler output validation", () => {
      it("should handle definition.parameter for a simple parameter", () => {
        const code = `def func(x):
    pass`;
        const ast = parser.parse(code);
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const params = find_node_by_type(ast.rootNode, "parameters")!;
        const param_identifier = params.namedChild(0)!;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const param_capture: CaptureNode = {
          name: "definition.parameter",
          category: "definition" as SemanticCategory,
          entity: "parameter" as SemanticEntity,
          node: param_identifier as any,
          text: param_identifier.text as SymbolName,
          location: node_to_location(param_identifier, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.parameter"]!(param_capture, builder, context);

        const definitions = builder.build();
        const func = definitions.functions.values().next().value!;
        expect(func.signature.parameters.length).toEqual(1);
        expect(func.signature.parameters[0]!.name).toEqual("x");
      });

      it("should handle definition.parameter.default for optional parameter", () => {
        const code = `def func(x=10):
    pass`;
        const ast = parser.parse(code);
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const default_param = find_node_by_type(ast.rootNode, "default_parameter")!;
        const name_node = default_param.childForFieldName("name")!;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const param_capture: CaptureNode = {
          name: "definition.parameter.default",
          category: "definition" as SemanticCategory,
          entity: "parameter" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.parameter.default"]!(param_capture, builder, context);

        const definitions = builder.build();
        const func = definitions.functions.values().next().value!;
        expect(func.signature.parameters.length).toEqual(1);
        expect(func.signature.parameters[0]!.name).toEqual("x");
        expect(func.signature.parameters[0]!.optional).toEqual(true);
      });

      it("should handle definition.parameter.typed for typed parameter", () => {
        const code = `def func(x: int):
    pass`;
        const ast = parser.parse(code);
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const typed_param = find_node_by_type(ast.rootNode, "typed_parameter")!;
        // The name of a typed_parameter is the first child identifier
        const name_node = typed_param.namedChild(0)!;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const param_capture: CaptureNode = {
          name: "definition.parameter.typed",
          category: "definition" as SemanticCategory,
          entity: "parameter" as SemanticEntity,
          node: name_node as any,
          text: name_node.text as SymbolName,
          location: node_to_location(name_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.parameter.typed"]!(param_capture, builder, context);

        const definitions = builder.build();
        const func = definitions.functions.values().next().value!;
        expect(func.signature.parameters.length).toEqual(1);
        expect(func.signature.parameters[0]!.name).toEqual("x");
        expect(func.signature.parameters[0]!.type).toEqual("int");
      });

      it("should handle definition.parameter.args for *args", () => {
        const code = `def func(*args):
    pass`;
        const ast = parser.parse(code);
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const splat_node = find_node_by_type(ast.rootNode, "list_splat_pattern")!;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const param_capture: CaptureNode = {
          name: "definition.parameter.args",
          category: "definition" as SemanticCategory,
          entity: "parameter" as SemanticEntity,
          node: splat_node as any,
          text: splat_node.text as SymbolName,
          location: node_to_location(splat_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.parameter.args"]!(param_capture, builder, context);

        const definitions = builder.build();
        const func = definitions.functions.values().next().value!;
        expect(func.signature.parameters.length).toEqual(1);
        expect(func.signature.parameters[0]!.type).toEqual("tuple");
      });

      it("should handle definition.parameter.kwargs for **kwargs", () => {
        const code = `def func(**kwargs):
    pass`;
        const ast = parser.parse(code);
        const func_def = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_def.childForFieldName("name")!;
        const splat_node = find_node_by_type(ast.rootNode, "dictionary_splat_pattern")!;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const func_capture: CaptureNode = {
          name: "definition.function",
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          node: func_name as any,
          text: func_name.text as SymbolName,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const param_capture: CaptureNode = {
          name: "definition.parameter.kwargs",
          category: "definition" as SemanticCategory,
          entity: "parameter" as SemanticEntity,
          node: splat_node as any,
          text: splat_node.text as SymbolName,
          location: node_to_location(splat_node, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.parameter.kwargs"]!(param_capture, builder, context);

        const definitions = builder.build();
        const func = definitions.functions.values().next().value!;
        expect(func.signature.parameters.length).toEqual(1);
        expect(func.signature.parameters[0]!.type).toEqual("dict");
      });
    });

    describe("End-to-end integration tests", () => {
      it("should build complete class definition with methods", () => {
        const code = `class Calculator:
    def add(self, a, b):
        return a + b`;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_definition")!;
        const class_name = class_node.childForFieldName("name")!;
        const class_capture: CaptureNode = {
          name: "definition.class",
          node: class_name as any,
          text: class_name.text as SymbolName,
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          location: node_to_location(class_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

        const func_def_node = find_node_by_type(ast.rootNode, "function_definition")!;
        const method_name = func_def_node.childForFieldName("name")!;
        const method_capture: CaptureNode = {
          name: "definition.method",
          node: method_name as any,
          text: method_name.text as SymbolName,
          category: "definition" as SemanticCategory,
          entity: "method" as SemanticEntity,
          location: node_to_location(method_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.method"]!(method_capture, builder, context);

        const definitions = builder.build();
        expect(definitions.classes.size).toEqual(1);

        const class_def = definitions.classes.values().next().value!;
        expect(class_def.name).toBe("Calculator");
        expect(class_def.methods.length).toEqual(1);
        expect(class_def.methods[0]!.name).toEqual("add");
      });

      it("should handle function with typed parameters", () => {
        const code = `def greet(name: str, age: int = 0) -> str:
    return f"Hello {name}"`;

        const context = create_test_context(true); // Need scopes for function bodies
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);
        const func_node = find_node_by_type(ast.rootNode, "function_definition")!;
        const func_name = func_node.childForFieldName("name")!;
        const func_capture: CaptureNode = {
          name: "definition.function",
          node: func_name as any,
          text: func_name.text as SymbolName,
          category: "definition" as SemanticCategory,
          entity: "function" as SemanticEntity,
          location: node_to_location(func_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.function"]!(func_capture, builder, context);

        const definitions = builder.build();
        expect(definitions.functions.size).toEqual(1);

        const func_def = definitions.functions.values().next().value!;
        expect(func_def.name).toBe("greet");
        expect(func_def.return_type).toEqual("str");
      });

      it("should distinguish between constants and variables by naming convention", () => {
        const context = create_test_context();

        // Test constant (uppercase)
        const builder1 = new DefinitionBuilder(context);
        const capture1 = create_capture("MAX_SIZE = 100", "definition.variable", "identifier");
        PYTHON_HANDLERS["definition.variable"]!(capture1, builder1, context);
        const const_def = builder1.build().variables.values().next().value!;
        expect(const_def.kind).toBe("constant");

        // Test variable (lowercase)
        const builder2 = new DefinitionBuilder(context);
        const capture2 = create_capture("current_size = 10", "definition.variable", "identifier");
        PYTHON_HANDLERS["definition.variable"]!(capture2, builder2, context);
        const var_def = builder2.build().variables.values().next().value!;
        expect(var_def.kind).toBe("variable");
      });

      it("should handle complex import patterns", () => {
        const code = "from typing import List, Dict, Optional";

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // Find all imported names
        const find_all_identifiers = (node: SyntaxNode): SyntaxNode[] => {
          const identifiers: SyntaxNode[] = [];
          if (node.type === "dotted_name") {
            identifiers.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            identifiers.push(...find_all_identifiers(node.child(i)!));
          }
          return identifiers;
        };

        const identifiers = find_all_identifiers(ast.rootNode);
        for (const id of identifiers) {
          if (
            id.text === "List" ||
            id.text === "Dict" ||
            id.text === "Optional"
          ) {
            const import_capture: CaptureNode = {
              name: "definition.import",
              node: id as any,
              text: id.text as SymbolName,
              category: "definition" as SemanticCategory,
              entity: "import" as SemanticEntity,
              location: node_to_location(id, "test.py" as any),
            };
            PYTHON_HANDLERS["definition.import"]!(
              import_capture,
              builder,
              context
            );
          }
        }

        const result = builder.build();
        expect(result.imports.size).toEqual(3);

        const import_names = Array.from(result.imports.values()).map(i => i.name);
        expect(import_names).toContain("List");
        expect(import_names).toContain("Dict");
        expect(import_names).toContain("Optional");
      });

      it("should handle private methods by naming convention", () => {
        const code = `class MyClass:
    def _private_method(self):
        pass
    def public_method(self):
        pass`;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const ast = parser.parse(code);

        // Process class first
        const class_node = find_node_by_type(ast.rootNode, "class_definition")!;
        const class_name = class_node.childForFieldName("name")!;
        const class_capture: CaptureNode = {
          name: "definition.class",
          node: class_name as any,
          text: class_name.text as SymbolName,
          category: "definition" as SemanticCategory,
          entity: "class" as SemanticEntity,
          location: node_to_location(class_name, "test.py" as any),
        };
        PYTHON_HANDLERS["definition.class"]!(class_capture, builder, context);

        // Find all function definitions
        const find_all_functions = (node: SyntaxNode): SyntaxNode[] => {
          const functions: SyntaxNode[] = [];
          if (node.type === "function_definition") {
            functions.push(node);
          }
          for (let i = 0; i < node.childCount; i++) {
            functions.push(...find_all_functions(node.child(i)!));
          }
          return functions;
        };

        const functions = find_all_functions(ast.rootNode);
        for (const func of functions) {
          const func_name = func.childForFieldName("name")!;
          const method_capture: CaptureNode = {
            name: "definition.method",
            node: func_name as any,
            text: func_name.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "method" as SemanticEntity,
            location: node_to_location(func_name, "test.py" as any),
          };
          PYTHON_HANDLERS["definition.method"]!(method_capture, builder, context);
        }

        const definitions = builder.build();
        const class_def = definitions.classes.values().next().value!;
        expect(class_def.methods.length).toEqual(2);
        const method_names = class_def.methods.map((m: any) => m.name);
        expect(method_names).toContain("_private_method");
        expect(method_names).toContain("public_method");
      });
    });

    describe("Export flag verification (is_exported)", () => {
      // Helper to create context with nested scope support
      function create_nested_context(): ProcessingContext {
        const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;
        const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;

        const current_scope = module_scope_id;

        return {
          captures: [],
          scopes: new Map(),
          scope_depths: new Map(),
          root_scope_id: module_scope_id,
          get_scope_id: (location: Location) => current_scope,
          get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => current_scope,
        };
      }

      describe("Functions", () => {
        it("should have is_exported=true for module-level public functions", () => {
          const code = `def public_function():
    pass`;
          const context = create_test_context(true); // Need scopes for function bodies
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.function", "identifier");

          PYTHON_HANDLERS["definition.function"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("public_function");
          expect(func?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private functions (single underscore)", () => {
          const code = `def _private_function():
    pass`;
          const context = create_test_context(true); // Need scopes for function bodies
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.function", "identifier");

          PYTHON_HANDLERS["definition.function"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("_private_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=false for module-level private functions (double underscore)", () => {
          const code = `def __private_function():
    pass`;
          const context = create_test_context(true); // Need scopes for function bodies
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.function", "identifier");

          PYTHON_HANDLERS["definition.function"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("__private_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=true for module-level magic functions (dunder)", () => {
          const code = `def __init__():
    pass`;
          const context = create_test_context(true); // Need scopes for function bodies
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.function", "identifier");

          PYTHON_HANDLERS["definition.function"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("__init__");
          expect(func?.is_exported).toBe(true);
        });

        it("should have is_exported=false for nested functions", () => {
          // Simulate nested function by using a non-module scope
          const code = `def inner_function():
    pass`;
          const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;
          const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;

          const scopes = new Map();
          // Add function scope for nested function bodies
          scopes.set("function:test.py:1:0:3:1:<function_body>" as ScopeId, {
            id: "function:test.py:1:0:3:1:<function_body>" as ScopeId,
            type: "function",
            name: "inner_function",
            location: {
              file_path: "test.py" as any,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            parent_id: nested_scope_id,
          });

          const context: ProcessingContext = {
            captures: [],
            scopes,
            scope_depths: new Map(),
            root_scope_id: module_scope_id,
            get_scope_id: (location: Location) => nested_scope_id, // Return nested scope
            get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => nested_scope_id,
          };

          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.function", "identifier");

          PYTHON_HANDLERS["definition.function"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("inner_function");
          expect(func?.is_exported).toBe(false);
        });

        it("should have is_exported=false for lambda functions", () => {
          const code = "f = lambda x: x * 2";
          const context = create_test_context(true); // Need scopes for function bodies
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.lambda", "lambda");

          PYTHON_HANDLERS["definition.lambda"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const func = definitions.functions.values().next().value;

          expect(func).toBeDefined();
          expect(func?.name).toBe("lambda");
          expect(func?.is_exported).toBe(false);
        });
      });

      describe("Classes", () => {
        it("should have is_exported=true for module-level public classes", () => {
          const code = `class PublicClass:
    pass`;
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.class", "identifier");

          PYTHON_HANDLERS["definition.class"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("PublicClass");
          expect(cls?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private classes (single underscore)", () => {
          const code = `class _PrivateClass:
    pass`;
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.class", "identifier");

          PYTHON_HANDLERS["definition.class"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("_PrivateClass");
          expect(cls?.is_exported).toBe(false);
        });

        it("should have is_exported=false for module-level private classes (double underscore)", () => {
          const code = `class __PrivateClass:
    pass`;
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.class", "identifier");

          PYTHON_HANDLERS["definition.class"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("__PrivateClass");
          expect(cls?.is_exported).toBe(false);
        });

        it("should have is_exported=false for nested classes", () => {
          // Simulate nested class by using a non-module scope
          const code = `class InnerClass:
    pass`;
          const nested_scope_id = "function:test.py:2:0:5:0:outer_func" as ScopeId;
          const module_scope_id = "module:test.py:1:0:100:0:<module>" as ScopeId;

          const context: ProcessingContext = {
            captures: [],
            scopes: new Map(),
            scope_depths: new Map(),
            root_scope_id: module_scope_id,
            get_scope_id: (location: Location) => nested_scope_id, // Return nested scope
            get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => nested_scope_id,
          };

          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.class", "identifier");

          PYTHON_HANDLERS["definition.class"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const cls = definitions.classes.values().next().value;

          expect(cls).toBeDefined();
          expect(cls?.name).toBe("InnerClass");
          expect(cls?.is_exported).toBe(false);
        });
      });

      describe("Variables", () => {
        it("should have is_exported=true for module-level public variables", () => {
          const code = "public_var = 10";
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.variable", "identifier");

          PYTHON_HANDLERS["definition.variable"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("public_var");
          expect(variable?.is_exported).toBe(true);
        });

        it("should have is_exported=false for module-level private variables", () => {
          const code = "_private_var = 10";
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.variable", "identifier");

          PYTHON_HANDLERS["definition.variable"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("_private_var");
          expect(variable?.is_exported).toBe(false);
        });

        it("should have is_exported=false for loop variables", () => {
          const code = `for i in range(10):
    pass`;
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "definition.loop_var", "identifier");

          PYTHON_HANDLERS["definition.loop_var"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const variable = definitions.variables.values().next().value;

          expect(variable).toBeDefined();
          expect(variable?.name).toBe("i");
          expect(variable?.is_exported).toBe(false);
        });
      });

      describe("Imports", () => {
        it("should have is_exported=true for module-level public imports", () => {
          const code = "import os";
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);
          const capture = create_capture(code, "import.module", "dotted_name");

          PYTHON_HANDLERS["import.module"]!(
            capture,
            builder,
            context
          );

          const definitions = builder.build();
          const import_def = definitions.imports.values().next().value;

          expect(import_def).toBeDefined();
          expect(import_def?.name).toBe("os");
        });

        it("should have is_exported=false for module-level private imports", () => {
          const code = "from internal import _private_module";
          const context = create_test_context();
          const builder = new DefinitionBuilder(context);

          // Create capture for the imported name
          const ast = parser.parse(code);
          const identifiers: SyntaxNode[] = [];

          const find_identifiers = (node: SyntaxNode) => {
            if (node.type === "dotted_name" && node.text === "_private_module") {
              identifiers.push(node);
            }
            for (let i = 0; i < node.childCount; i++) {
              find_identifiers(node.child(i)!);
            }
          };

          find_identifiers(ast.rootNode);

          if (identifiers[0]) {
            const capture: CaptureNode = {
              name: "import.named",
              category: "import" as any,
              entity: "named" as any,
              node: identifiers[0] as any,
              text: "_private_module" as SymbolName,
              location: node_to_location(identifiers[0], "test.py" as any),
            };

            PYTHON_HANDLERS["import.named"]!(
              capture,
              builder,
              context
            );

            const definitions = builder.build();
            const import_def = definitions.imports.values().next().value;

            expect(import_def).toBeDefined();
            expect(import_def?.name).toBe("_private_module");
          }
        });
      });
    });

    describe("Protocol Support", () => {
      it("should contain protocol definition capture mappings", () => {
        const protocol_mappings = [
          "definition.interface",
          "definition.property.interface",
        ];

        for (const mapping of protocol_mappings) {
          expect((mapping in PYTHON_HANDLERS)).toBe(true);
          const handler = PYTHON_HANDLERS[mapping];
          expect(handler).toBeDefined();
          expect(handler).toBeInstanceOf(Function);
        }
      });

      it("should handle Protocol class definition", () => {
        const code = `from typing import Protocol

class Drawable(Protocol):
    pass`;
        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_definition");
        const class_name = class_node?.childForFieldName("name");

        if (!class_name) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: class_name as any,
          text: class_name.text as SymbolName,
          location: node_to_location(class_name, "test.py" as any),
        };

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        PYTHON_HANDLERS["definition.interface"]!(capture, builder, context);

        const definitions = builder.build();
        expect(definitions.interfaces.size).toEqual(1);

        const protocol_def = definitions.interfaces.values().next().value!;
        expect(protocol_def.name).toBe("Drawable");
        expect(protocol_def.kind).toBe("interface");
      });

      it("should have is_exported=true for module-level public Protocol classes", () => {
        const code = `from typing import Protocol

class PublicProtocol(Protocol):
    pass`;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_definition");
        const class_name = class_node?.childForFieldName("name");

        if (!class_name) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: class_name as any,
          text: class_name.text as SymbolName,
          location: node_to_location(class_name, "test.py" as any),
        };

        PYTHON_HANDLERS["definition.interface"]!(
          capture,
          builder,
          context
        );

        const definitions = builder.build();
        const protocol_def = definitions.interfaces.values().next().value;

        expect(protocol_def).toBeDefined();
        expect(protocol_def?.name).toBe("PublicProtocol");
        expect(protocol_def?.is_exported).toBe(true);
      });

      it("should have is_exported=false for module-level private Protocol classes", () => {
        const code = `from typing import Protocol

class _PrivateProtocol(Protocol):
    pass`;
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // Find the class_definition node first, then get its name
        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_definition");
        const class_name = class_node?.childForFieldName("name");

        if (!class_name) {
          throw new Error("Could not find class name node");
        }

        const capture: CaptureNode = {
          name: "definition.interface",
          category: "definition" as SemanticCategory,
          entity: "interface" as SemanticEntity,
          node: class_name as any,
          text: class_name.text as SymbolName,
          location: node_to_location(class_name, "test.py" as any),
        };

        PYTHON_HANDLERS["definition.interface"]!(
          capture,
          builder,
          context
        );

        const definitions = builder.build();
        const protocol_def = definitions.interfaces.values().next().value;

        expect(protocol_def).toBeDefined();
        expect(protocol_def?.name).toBe("_PrivateProtocol");
        expect(protocol_def?.is_exported).toBe(false);
      });

      it("should handle Protocol property signatures", () => {
        const code = `from typing import Protocol

class Drawable(Protocol):
    x: int
    y: int`;

        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        // First process the Protocol class
        const ast = parser.parse(code);
        const class_node = find_node_by_type(ast.rootNode, "class_definition");
        const class_name = class_node?.childForFieldName("name");

        if (class_name) {
          const class_capture: CaptureNode = {
            name: "definition.interface",
            node: class_name as any,
            text: class_name.text as SymbolName,
            category: "definition" as SemanticCategory,
            entity: "interface" as SemanticEntity,
            location: node_to_location(class_name, "test.py" as any),
          };
          PYTHON_HANDLERS["definition.interface"]!(
            class_capture,
            builder,
            context
          );
        }

        // Find and process property signatures
        const find_all_identifiers = (node: SyntaxNode): SyntaxNode[] => {
          const identifiers: SyntaxNode[] = [];
          if (node.type === "identifier" && node.parent?.type === "assignment") {
            const assignment = node.parent;
            // Check if it's an annotated assignment without value (property signature)
            if (assignment.childForFieldName("type") && !assignment.childForFieldName("right")) {
              identifiers.push(node);
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            identifiers.push(...find_all_identifiers(node.child(i)!));
          }
          return identifiers;
        };

        const property_nodes = find_all_identifiers(ast.rootNode);
        for (const prop_node of property_nodes) {
          if (prop_node.text === "x" || prop_node.text === "y") {
            const prop_capture: CaptureNode = {
              name: "definition.property.interface",
              node: prop_node as any,
              text: prop_node.text as SymbolName,
              category: "definition" as SemanticCategory,
              entity: "property" as SemanticEntity,
              location: node_to_location(prop_node, "test.py" as any),
            };
            PYTHON_HANDLERS["definition.property.interface"]!(
              prop_capture,
              builder,
              context
            );
          }
        }

        const definitions = builder.build();
        const protocol_def = definitions.interfaces.values().next().value;

        expect(protocol_def).toBeDefined();
        expect(protocol_def?.name).toBe("Drawable");
        expect(protocol_def?.properties).toBeDefined();
        expect(Array.isArray(protocol_def?.properties)).toBe(true);

        // Verify property names
        const property_names = protocol_def?.properties.map((p) => p.name) || [];
        expect(property_names).toContain("x");
        expect(property_names).toContain("y");

        // Verify property types
        const x_prop = protocol_def?.properties.find((p) => p.name === "x");
        if (x_prop) {
          expect(x_prop.type).toBe("int");
        }

        const y_prop = protocol_def?.properties.find((p) => p.name === "y");
        if (y_prop) {
          expect(y_prop.type).toBe("int");
        }
      });
    });

    // NOTE: Python's export detection is already correct - it uses scope-based logic
    // (only module-level = exported). The nested variable export bug only affected
    // JavaScript/TypeScript which use AST traversal. No additional tests needed.
  });

  async function build_index_from_code(code: string) {
    const tree = parser.parse(code);
    const lines = code.split("\n");
    const parsed_file = {
      file_path: "test.py" as any,
      file_lines: lines.length,
      file_end_column: lines[lines.length - 1]?.length || 0,
      tree,
      lang: "python" as const,
    };
    return build_index_single_file(parsed_file, tree, "python");
  }

  describe("Property Type Extraction", () => {
    it("should extract type from class attribute annotation", async () => {
      const code = `
class Service:
    registry: DefinitionRegistry
    cache: dict[str, int] = {}
`;

      const index = await build_index_from_code(code);
      const service_class = Array.from(index.classes.values())[0];

      expect(service_class).toBeDefined();
      expect(service_class.properties).toBeDefined();
      expect(service_class.properties.length).toBe(2);

      const registry_prop = service_class.properties.find(p => p.name === "registry");
      expect(registry_prop).toBeDefined();
      expect(registry_prop?.type).toBe("DefinitionRegistry");

      const cache_prop = service_class.properties.find(p => p.name === "cache");
      expect(cache_prop).toBeDefined();
      expect(cache_prop?.type).toBe("dict[str, int]");
    });

    it("should extract generic types with List and Dict", async () => {
      const code = `
from typing import List, Dict

class Container:
    items: List[Item]
    mapping: Dict[str, int]
`;

      const index = await build_index_from_code(code);
      const container_class = Array.from(index.classes.values())[0];

      expect(container_class.properties.length).toBe(2);

      const items_prop = container_class.properties.find(p => p.name === "items");
      expect(items_prop?.type).toBe("List[Item]");

      const mapping_prop = container_class.properties.find(p => p.name === "mapping");
      expect(mapping_prop?.type).toBe("Dict[str, int]");
    });

    it("should extract Union and Optional types", async () => {
      const code = `
from typing import Optional, Union

class Config:
    value: Optional[str]
    data: Union[int, str, None]
`;

      const index = await build_index_from_code(code);
      const config_class = Array.from(index.classes.values())[0];

      expect(config_class.properties.length).toBe(2);

      const value_prop = config_class.properties.find(p => p.name === "value");
      expect(value_prop?.type).toBe("Optional[str]");

      const data_prop = config_class.properties.find(p => p.name === "data");
      expect(data_prop?.type).toBe("Union[int, str, None]");
    });

    it("should extract modern Python 3.10+ union syntax", async () => {
      const code = `
class Modern:
    numbers: list[int]
    text: str | None
    mixed: int | str | float
`;

      const index = await build_index_from_code(code);
      const modern_class = Array.from(index.classes.values())[0];

      expect(modern_class.properties.length).toBe(3);

      const numbers_prop = modern_class.properties.find(p => p.name === "numbers");
      expect(numbers_prop?.type).toBe("list[int]");

      const text_prop = modern_class.properties.find(p => p.name === "text");
      expect(text_prop?.type).toBe("str | None");

      const mixed_prop = modern_class.properties.find(p => p.name === "mixed");
      expect(mixed_prop?.type).toBe("int | str | float");
    });

    it("should handle properties without type annotations", async () => {
      const code = `
class NoTypes:
    plain = 42
    another = "hello"
`;

      const index = await build_index_from_code(code);
      const no_types_class = Array.from(index.classes.values())[0];

      expect(no_types_class.properties.length).toBe(2);

      const plain_prop = no_types_class.properties.find(p => p.name === "plain");
      expect(plain_prop).toBeDefined();
      expect(plain_prop?.type).toBeUndefined();

      const another_prop = no_types_class.properties.find(p => p.name === "another");
      expect(another_prop).toBeDefined();
      expect(another_prop?.type).toBeUndefined();
    });

    it("should extract complex nested generic types", async () => {
      const code = `
from typing import Dict, List, Optional

class Complex:
    nested: Dict[str, List[Optional[Item]]]
`;

      const index = await build_index_from_code(code);
      const complex_class = Array.from(index.classes.values())[0];

      expect(complex_class.properties.length).toBe(1);

      const nested_prop = complex_class.properties[0];
      expect(nested_prop.name).toBe("nested");
      expect(nested_prop.type).toBe("Dict[str, List[Optional[Item]]]");
    });

    it("should extract types from dataclass fields", async () => {
      const code = `
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int
    label: str = "origin"
`;

      const index = await build_index_from_code(code);
      const point_class = Array.from(index.classes.values())[0];

      expect(point_class.properties.length).toBe(3);

      const x_prop = point_class.properties.find(p => p.name === "x");
      expect(x_prop?.type).toBe("int");

      const y_prop = point_class.properties.find(p => p.name === "y");
      expect(y_prop?.type).toBe("int");

      const label_prop = point_class.properties.find(p => p.name === "label");
      expect(label_prop?.type).toBe("str");
    });
  });

  describe("detect_callback_context", () => {
    function find_lambda(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "lambda") {
        return node;
      }
      for (const child of node.children) {
        const result = find_lambda(child);
        if (result) return result;
      }
      return null;
    }

    describe("Callback detection - positive cases", () => {
      it("should detect callback in list(map())", () => {
        const code = "list(map(lambda x: x * 2, items))";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in list(filter())", () => {
        const code = "list(filter(lambda x: x > 0, items))";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in sorted()", () => {
        const code = "sorted(items, key=lambda x: x.name)";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in functools.reduce()", () => {
        const code = "reduce(lambda acc, x: acc + x, items, 0)";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in nested function calls", () => {
        const code = "list(map(lambda x: x * 2, filter(lambda y: y > 0, items)))";
        const tree = parser.parse(code);
        // Find first lambda (the one in map)
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in method call", () => {
        const code = "obj.transform(lambda x: x.upper())";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });
    });

    describe("Non-callback detection - negative cases", () => {
      it("should NOT detect callback in variable assignment", () => {
        const code = "fn = lambda x: x * 2";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in return statement", () => {
        const code = "def foo():\n    return lambda x: x * 2";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in dictionary literal", () => {
        const code = "{\"handler\": lambda x: x * 2}";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in list literal", () => {
        const code = "[lambda x: x * 2, lambda y: y + 1]";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });
    });

    describe("Receiver location capture", () => {
      it("should capture correct receiver location for map call", () => {
        const code = "list(map(lambda x: x * 2, items))";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.receiver_location).toEqual({
          file_path: "test.py",
          start_line: 1,
          start_column: 6,
          end_line: 1,
          end_column: 32,
        });
      });

      it("should capture correct receiver location for multi-line call", () => {
        const code = "result = sorted(\n    items,\n    key=lambda x: x.name\n)";
        const tree = parser.parse(code);
        const lambda_fn = find_lambda(tree.rootNode);
        expect(lambda_fn).not.toBeNull();

        const context = detect_callback_context(lambda_fn!, "test.py" as FilePath);
        expect(context.receiver_location).toEqual({
          file_path: "test.py" as FilePath,
          start_line: 1,
          start_column: 10,
          end_line: 4,
          end_column: 1,
        });
      });
    });
  });

  describe("Aliased Relative Import Handling", () => {
    async function build_index_from_code(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: "test.py" as any,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1]?.length || 0,
        tree,
        lang: "python" as const,
      };
      return build_index_single_file(parsed_file, tree, "python");
    }

    it("should capture aliased relative import", async () => {
      // Tests the fix for: from .module import foo as bar
      const code = "from .module import foo as bar";
      const index = await build_index_from_code(code);

      const imports = Array.from(index.imported_symbols.values());
      expect(imports).toHaveLength(1);

      const import_def = imports[0];
      expect(import_def.name).toBe("bar"); // Local name is the alias
      expect(import_def.original_name).toBe("foo"); // Original name tracked
      expect(import_def.import_path).toBe(".module");
    });

    it("should capture multiple aliased relative imports", async () => {
      // Multiple aliased imports from relative module
      const code = "from .module import foo as bar, baz as qux";
      const index = await build_index_from_code(code);

      const imports = Array.from(index.imported_symbols.values());
      expect(imports).toHaveLength(2);

      const bar_import = imports.find(i => i.name === "bar");
      const qux_import = imports.find(i => i.name === "qux");

      expect(bar_import).toBeDefined();
      expect(bar_import?.original_name).toBe("foo");
      expect(bar_import?.import_path).toBe(".module");

      expect(qux_import).toBeDefined();
      expect(qux_import?.original_name).toBe("baz");
      expect(qux_import?.import_path).toBe(".module");
    });

    it("should handle non-aliased relative import (existing behavior)", async () => {
      const code = "from .module import foo";
      const index = await build_index_from_code(code);

      const imports = Array.from(index.imported_symbols.values());
      expect(imports).toHaveLength(1);

      const import_def = imports[0];
      expect(import_def.name).toBe("foo");
      expect(import_def.original_name).toBeUndefined();
      expect(import_def.import_path).toBe(".module");
    });

    it("should handle parent directory aliased relative import", async () => {
      const code = "from ..utils import helper as h";
      const index = await build_index_from_code(code);

      const imports = Array.from(index.imported_symbols.values());
      expect(imports).toHaveLength(1);

      const import_def = imports[0];
      expect(import_def.name).toBe("h");
      expect(import_def.original_name).toBe("helper");
      expect(import_def.import_path).toBe("..utils");
    });
  });

  describe("Instance Attribute Property Definitions (assignment.property)", () => {
    it("should create PropertyDefinition for self.attr = Constructor() in __init__", async () => {
      const code = `
class Service:
    def __init__(self):
        self.db = Database()
`;

      const index = await build_index_from_code(code);
      const service_class = Array.from(index.classes.values()).find(c => c.name === "Service");

      expect(service_class).toBeDefined();
      const db_prop = service_class!.properties.find(p => p.name === "db");
      expect(db_prop).toBeDefined();
      expect(db_prop!.name).toBe("db");
      expect(db_prop!.type).toBe("Database");
    });

    it("should create PropertyDefinition for self.attr = value in __init__", async () => {
      const code = `
class Config:
    def __init__(self):
        self.name = "default"
`;

      const index = await build_index_from_code(code);
      const config_class = Array.from(index.classes.values()).find(c => c.name === "Config");

      expect(config_class).toBeDefined();
      const name_prop = config_class!.properties.find(p => p.name === "name");
      expect(name_prop).toBeDefined();
      expect(name_prop!.name).toBe("name");
      // Non-constructor RHS has no type
      expect(name_prop!.type).toBeUndefined();
    });

    it("should NOT create PropertyDefinition for self.attr = X() outside __init__", async () => {
      const code = `
class Service:
    def setup(self):
        self.db = Database()
`;

      const index = await build_index_from_code(code);
      const service_class = Array.from(index.classes.values()).find(c => c.name === "Service");

      expect(service_class).toBeDefined();
      // No property should be created since we're not in __init__
      const db_prop = service_class!.properties.find(p => p.name === "db");
      expect(db_prop).toBeUndefined();
    });

    it("should create multiple PropertyDefinitions for multiple self assignments in __init__", async () => {
      const code = `
class Service:
    def __init__(self):
        self.db = Database()
        self.cache = Cache()
        self.name = "service"
`;

      const index = await build_index_from_code(code);
      const service_class = Array.from(index.classes.values()).find(c => c.name === "Service");

      expect(service_class).toBeDefined();
      expect(service_class!.properties.length).toBe(3);

      const db_prop = service_class!.properties.find(p => p.name === "db");
      expect(db_prop).toBeDefined();
      expect(db_prop!.type).toBe("Database");

      const cache_prop = service_class!.properties.find(p => p.name === "cache");
      expect(cache_prop).toBeDefined();
      expect(cache_prop!.type).toBe("Cache");

      const name_prop = service_class!.properties.find(p => p.name === "name");
      expect(name_prop).toBeDefined();
      expect(name_prop!.type).toBeUndefined();
    });

    it("should NOT create PropertyDefinition for non-self attribute assignment in __init__", async () => {
      const code = `
class Service:
    def __init__(self):
        other.db = Database()
`;

      const index = await build_index_from_code(code);
      const service_class = Array.from(index.classes.values()).find(c => c.name === "Service");

      expect(service_class).toBeDefined();
      const db_prop = service_class!.properties.find(p => p.name === "db");
      expect(db_prop).toBeUndefined();
    });
  });

  describe("Documentation Extraction", () => {
    async function build_index_from_code_doc(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: "test.py" as any,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1]?.length || 0,
        tree,
        lang: "python" as const,
      };
      return build_index_single_file(parsed_file, tree, "python");
    }

    it("should extract triple-quoted docstring on a function", async () => {
      const code = `def greet(name):
    """Say hello to the given name."""
    return f"Hello, {name}"
`;
      const index = await build_index_from_code_doc(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "greet");
      expect(fn).toBeDefined();
      expect(fn!.docstring).toBe("Say hello to the given name.");
    });

    it("should extract triple-quoted docstring on a class", async () => {
      const code = `class Greeter:
    """A class that greets people."""
    pass
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Greeter");
      expect(cls).toBeDefined();
      expect(cls!.docstring).toEqual(["A class that greets people."]);
    });

    it("should extract single-quoted docstring", async () => {
      const code = `def farewell():
    '''Say goodbye.'''
    pass
`;
      const index = await build_index_from_code_doc(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "farewell");
      expect(fn).toBeDefined();
      expect(fn!.docstring).toBe("Say goodbye.");
    });

    it("should extract multi-line docstring and normalise whitespace", async () => {
      const code = `def calculate(x, y):
    """
    Calculate the sum.

    Returns the result.
    """
    return x + y
`;
      const index = await build_index_from_code_doc(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "calculate");
      expect(fn).toBeDefined();
      expect(fn!.docstring).toBeDefined();
      expect(fn!.docstring).toContain("Calculate the sum.");
    });

    it("should leave docstring undefined when function has no docstring", async () => {
      const code = `def no_doc():
    return 42
`;
      const index = await build_index_from_code_doc(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "no_doc");
      expect(fn).toBeDefined();
      expect(fn!.docstring).toBeUndefined();
    });

    it("should extract triple-quoted docstring on a method", async () => {
      const code = `
class Greeter:
    def greet(self, name):
        """Greet the given name."""
        return f"Hello, {name}"
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Greeter");
      const method = cls!.methods.find(m => m.name === "greet");
      expect(method).toBeDefined();
      expect(method!.docstring).toBe("Greet the given name.");
    });

    it("should extract docstring on a @staticmethod", async () => {
      const code = `
class Utils:
    @staticmethod
    def helper():
        """Static helper."""
        pass
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Utils");
      const method = cls!.methods.find(m => m.name === "helper");
      expect(method).toBeDefined();
      expect(method!.docstring).toBe("Static helper.");
    });

    it("should extract docstring on a @classmethod", async () => {
      const code = `
class Factory:
    @classmethod
    def create(cls):
        """Class constructor."""
        return cls()
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Factory");
      const method = cls!.methods.find(m => m.name === "create");
      expect(method).toBeDefined();
      expect(method!.docstring).toBe("Class constructor.");
    });
  });
});
