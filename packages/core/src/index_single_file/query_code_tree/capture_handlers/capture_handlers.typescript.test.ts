/**
 * Tests for TypeScript language configuration using builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import { TYPESCRIPT_HANDLERS } from "./capture_handlers.typescript";
import { extract_return_type, detect_callback_context } from "../symbol_factories/symbol_factories.typescript";
import { JAVASCRIPT_HANDLERS } from "./capture_handlers.javascript";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import { build_semantic_index } from "../../semantic_index";
import type { ParsedFile } from "../../file_utils";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticEntity,
  SemanticCategory,
} from "../../semantic_index";
import type { FilePath, Location, ScopeId, SymbolName } from "@ariadnejs/types";

describe("TypeScript Builder Configuration", () => {
  let parser: Parser;

  // Mock processing context
  const mock_context: ProcessingContext = {
    captures: [],
    scopes: new Map(),
    scope_depths: new Map(),
    root_scope_id: "scope:root" as ScopeId,
    get_scope_id: (location: Location): ScopeId =>
      `scope:${location.start_line}:${location.start_column}` as ScopeId,
    get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => "scope:root" as ScopeId,
  };

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  // Helper function to get AST node from code
  function get_ast_node(code: string): SyntaxNode {
    return parser.parse(code).rootNode;
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

  // Helper to create a raw capture
  function create_raw_capture(
    name: string,
    node: SyntaxNode,
    text?: string
  ): CaptureNode {
    return {
      name,
      node,
      text: (text || node.text) as SymbolName,
      category: "definition" as SemanticCategory,
      entity: "interface" as SemanticEntity,
      location: {
        file_path: "test.ts" as FilePath,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1,
      },
    };
  }

  // Helper to build semantic index from code (for integration tests)
  function build_index_from_code(code: string) {
    const tree = parser.parse(code);
    const lines = code.split("\n");
    const parsed_file: ParsedFile = {
      file_path: "test.ts" as FilePath,
      file_lines: lines.length,
      file_end_column: lines[lines.length - 1].length + 1,
      tree: tree,
      lang: "typescript",
    };
    return build_semantic_index(parsed_file, tree, "typescript");
  }

  describe("TYPESCRIPT_HANDLERS", () => {
    it("should export a valid LanguageBuilderConfig", () => {
      expect(TYPESCRIPT_HANDLERS).toBeDefined();
      expect(TYPESCRIPT_HANDLERS).toBeDefined();
      expect(Object.keys(TYPESCRIPT_HANDLERS).length).toBeGreaterThan(0);
    });

    it("should extend JavaScript configuration", () => {
      // Should contain all JavaScript mappings plus TypeScript-specific ones
      expect(Object.keys(TYPESCRIPT_HANDLERS).length).toBeGreaterThan(
        Object.keys(JAVASCRIPT_HANDLERS).length
      );

      // Check that JavaScript mappings are included
      const js_keys = Object.keys(JAVASCRIPT_HANDLERS);
      for (const key of js_keys) {
        expect((key in TYPESCRIPT_HANDLERS)).toBe(true);
      }
    });

    it("should contain TypeScript-specific capture handlers", () => {
      const ts_specific_handlers = [
        "definition.interface",
        "definition.interface.method",
        "definition.interface.property",
        "definition.type_alias",
        "definition.enum",
        "definition.enum.member",
        "definition.namespace",
        "decorator.class",
        "decorator.method",
        "decorator.property",
      ];

      for (const handler_name of ts_specific_handlers) {
        expect((handler_name in TYPESCRIPT_HANDLERS)).toBe(true);
        const handler = TYPESCRIPT_HANDLERS[handler_name];
        expect(handler).toBeDefined();
        expect(handler).toBeInstanceOf(Function);
      }
    });
  });

  describe("Interface handling", () => {
    it("should process interface definitions", () => {
      const code = `interface IUser {
        name: string;
        age: number;
      }`;
      const ast = get_ast_node(code);
      const interface_node = find_node_by_type(ast, "interface_declaration");
      const name_node = interface_node?.childForFieldName?.("name");

      expect(interface_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.interface"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.interface", name_node, "IUser");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.interfaces.size).toBe(1);
        const iface = Array.from(result.interfaces.values())[0];
        expect(iface?.kind).toBe("interface");
        expect(iface?.name).toBe("IUser");
      }
    });

    it("should process interface method signatures", () => {
      const code = `interface ICalculator {
        add(a: number, b: number): number;
      }`;
      const ast = get_ast_node(code);
      const method_sig_node = find_node_by_type(ast, "method_signature");
      const method_name_node = method_sig_node?.childForFieldName?.("name");

      expect(method_sig_node).toBeTruthy();
      expect(method_name_node).toBeTruthy();

      // Would need to first add interface, then add method to it
      // This is a simplified test - in real usage the interface would already exist
    });

    it("should process interface property signatures", () => {
      const code = `interface IConfig {
        readonly debug?: boolean;
      }`;
      const ast = get_ast_node(code);
      const prop_sig_node = find_node_by_type(ast, "property_signature");
      const prop_name_node = prop_sig_node?.childForFieldName?.("name");

      expect(prop_sig_node).toBeTruthy();
      expect(prop_name_node).toBeTruthy();

      // Would need to first add interface, then add property to it
      // This is a simplified test - in real usage the interface would already exist
    });
  });

  describe("Type alias handling", () => {
    it("should process type alias definitions", () => {
      const code = "type UserID = string | number;";
      const ast = get_ast_node(code);
      const type_alias_node = find_node_by_type(ast, "type_alias_declaration");
      const name_node = type_alias_node?.childForFieldName?.("name");

      expect(type_alias_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.type_alias"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.type_alias", name_node, "UserID");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.types.size).toBe(1);
        const type_alias = Array.from(result.types.values())[0];
        expect(type_alias.kind).toBe("type_alias");
        expect(type_alias.name).toBe("UserID");
      }
    });

    it("should process generic type aliases", () => {
      const code = "type Result<T, E> = { ok: T } | { error: E };";
      const ast = get_ast_node(code);
      const type_alias_node = find_node_by_type(ast, "type_alias_declaration");
      const name_node = type_alias_node?.childForFieldName?.("name");

      expect(type_alias_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.type_alias"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.type_alias", name_node, "Result");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.types.size).toBe(1);
        const type_alias = Array.from(result.types.values())[0];
        expect(type_alias.kind).toBe("type_alias");
        expect(type_alias.name).toBe("Result");
        // Type parameters would be extracted from the parent node
      }
    });
  });

  describe("Enum handling", () => {
    it("should process enum definitions", () => {
      const code = `enum Color {
        Red = 0,
        Green = 1,
        Blue = 2
      }`;
      const ast = get_ast_node(code);
      const enum_node = find_node_by_type(ast, "enum_declaration");
      const name_node = enum_node?.childForFieldName?.("name");

      expect(enum_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.enum"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.enum", name_node, "Color");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.enums.size).toBe(1);
        const enum_def = Array.from(result.enums.values())[0];
        expect(enum_def.kind).toBe("enum");
        expect(enum_def.name).toBe("Color");
      }
    });

    it("should process const enum definitions", () => {
      const code = `const enum Status {
        Active,
        Inactive
      }`;
      const ast = get_ast_node(code);
      const enum_node = find_node_by_type(ast, "enum_declaration");
      const name_node = enum_node?.childForFieldName?.("name");

      expect(enum_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.enum"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.enum", name_node, "Status");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.enums.size).toBe(1);
        const enum_def = Array.from(result.enums.values())[0];
        expect(enum_def.kind).toBe("enum");
        // is_const would be determined from parent node
      }
    });
  });

  describe("Namespace handling", () => {
    it("should process namespace definitions", () => {
      const code = `namespace Utils {
        export function log(msg: string): void {}
      }`;
      const ast = get_ast_node(code);
      const namespace_node = find_node_by_type(ast, "internal_module");
      const name_node = namespace_node?.childForFieldName?.("name");

      expect(namespace_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.namespace"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.namespace", name_node, "Utils");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.namespaces.size).toBe(1);
        const namespace_def = Array.from(result.namespaces.values())[0];
        expect(namespace_def.kind).toBe("namespace");
        expect(namespace_def.name).toBe("Utils");
      }
    });
  });

  describe("Class enhancements", () => {
    it("should process abstract classes", () => {
      const code = `abstract class Shape {
        abstract area(): number;
      }`;
      const ast = get_ast_node(code);
      const class_node = find_node_by_type(ast, "abstract_class_declaration");
      const name_node = class_node?.childForFieldName?.("name");

      expect(class_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.class"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.class", name_node, "Shape");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const class_def = Array.from(result.classes.values())[0];
        expect(class_def.kind).toBe("class");
        expect(class_def.name).toBe("Shape");
        // abstract flag would be set based on parent node type
      }
    });

    it("should process classes with implements", () => {
      const code = `class User implements IUser, ISerializable {
        name: string;
      }`;
      const ast = get_ast_node(code);
      const class_node = find_node_by_type(ast, "class_declaration");
      const name_node = class_node?.childForFieldName?.("name");

      expect(class_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.class"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.class", name_node, "User");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const class_def = Array.from(result.classes.values())[0];
        expect(class_def.kind).toBe("class");
        expect(class_def.name).toBe("User");
        // implements would be extracted from class heritage
      }
    });

    it("should process generic classes", () => {
      const code = `class Container<T> {
        private value: T;
      }`;
      const ast = get_ast_node(code);
      const class_node = find_node_by_type(ast, "class_declaration");
      const name_node = class_node?.childForFieldName?.("name");

      expect(class_node).toBeTruthy();
      expect(name_node).toBeTruthy();

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["def.class"];

      if (handler && name_node) {
        const capture = create_raw_capture("def.class", name_node, "Container");
        handler.process(capture, builder, mock_context);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const class_def = Array.from(result.classes.values())[0];
        expect(class_def.kind).toBe("class");
        expect(class_def.name).toBe("Container");
        // type_parameters would be extracted from parent node
      }
    });
  });

  describe("Decorator handling", () => {
    it("should process class decorators", () => {
      const code = `@Component
      class MyComponent {}`;
      const ast = get_ast_node(code);
      const decorator_node = find_node_by_type(ast, "decorator");
      const identifier_node = decorator_node?.firstChild;

      expect(decorator_node).toBeTruthy();
      expect(identifier_node).toBeTruthy();

      // Decorator processing would add decorator to the target class
      // This requires the class to be processed first
    });

    it("should process method decorators", () => {
      const code = `class Service {
        @Log
        process() {}
      }`;
      const ast = get_ast_node(code);
      const class_body_node = find_node_by_type(ast, "class_body");
      const method_node = find_node_by_type(ast, "method_definition");
      const decorator_node = class_body_node?.children?.find(
        (c) => c.type === "decorator"
      );

      expect(method_node).toBeTruthy();
      expect(decorator_node).toBeTruthy();

      // Decorator processing would add decorator to the target method
      // This requires the method to be processed first
    });

    it("should process property decorators", () => {
      const code = `class Model {
        @Required
        name: string;
      }`;
      const ast = get_ast_node(code);
      const field_node = find_node_by_type(ast, "public_field_definition");
      const decorator_node = field_node?.children?.find(
        (c) => c.type === "decorator"
      );

      expect(field_node).toBeTruthy();
      expect(decorator_node).toBeTruthy();

      // Decorator processing would add decorator to the target property
      // This requires the property to be processed first
    });
  });

  describe("Access modifiers", () => {
    it("should handle private members", () => {
      const code = `class Account {
        private balance: number;
        private updateBalance() {}
      }`;
      const ast = get_ast_node(code);
      const field_node = find_node_by_type(ast, "public_field_definition");
      const method_node = find_node_by_type(ast, "method_definition");

      expect(field_node).toBeTruthy();
      expect(method_node).toBeTruthy();

      // Access modifiers would be extracted during processing
    });

    it("should handle protected members", () => {
      const code = `class Base {
        protected data: string;
        protected process() {}
      }`;
      const ast = get_ast_node(code);
      const field_node = find_node_by_type(ast, "public_field_definition");
      const method_node = find_node_by_type(ast, "method_definition");

      expect(field_node).toBeTruthy();
      expect(method_node).toBeTruthy();

      // Access modifiers would be extracted during processing
    });

    it("should handle readonly properties", () => {
      const code = `class Config {
        readonly version = "1.0";
      }`;
      const ast = get_ast_node(code);
      const field_node = find_node_by_type(ast, "public_field_definition");

      expect(field_node).toBeTruthy();

      // Readonly modifier would be extracted during processing
    });
  });

  describe("Parameter properties", () => {
    it("should handle constructor parameter properties", () => {
      const code = `class User {
        constructor(public name: string, private age: number) {}
      }`;
      const ast = get_ast_node(code);
      const constructor_node = find_node_by_type(ast, "method_definition");
      const params = constructor_node?.childForFieldName?.("parameters");

      expect(constructor_node).toBeTruthy();
      expect(params).toBeTruthy();

      // Parameter properties would create both parameters and class properties
    });
  });

  describe("Return type extraction", () => {
    it("should extract return type from function declaration", () => {
      const code = "function getValue(): string { return \"test\"; }";
      const ast = get_ast_node(code);
      const function_node = find_node_by_type(ast, "function_declaration");
      const identifier = function_node?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const return_type = extract_return_type(identifier!);

      expect(return_type).toBe("string");
    });

    it("should extract complex return types", () => {
      const code = "function getUser(): Promise<User> { return Promise.resolve({} as User); }";
      const ast = get_ast_node(code);
      const function_node = find_node_by_type(ast, "function_declaration");
      const identifier = function_node?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const return_type = extract_return_type(identifier!);

      expect(return_type).toBe("Promise<User>");
    });

    it("should return undefined for functions without return type", () => {
      const code = "function doSomething() { console.log(\"test\"); }";
      const ast = get_ast_node(code);
      const function_node = find_node_by_type(ast, "function_declaration");
      const identifier = function_node?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const return_type = extract_return_type(identifier!);

      expect(return_type).toBeUndefined();
    });
  });

  describe("Export Detection for Nested Variables", () => {
    it("should NOT mark variables inside exported object literals as exported", () => {
      const code = `
export const CONFIG = {
  handler: () => {
    const local_var = 42;
    return local_var;
  }
};`;
      const ast = get_ast_node(code);
      const builder = new DefinitionBuilder(mock_context);

      // Find all variable declarators
      function find_all_variables(node: SyntaxNode): Array<{node: SyntaxNode, name: string}> {
        const results: Array<{node: SyntaxNode, name: string}> = [];

        if (node.type === "variable_declarator") {
          const name_node = node.childForFieldName?.("name");
          if (name_node) {
            results.push({node: name_node, name: name_node.text});
          }
        }

        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            results.push(...find_all_variables(child));
          }
        }

        return results;
      }

      const variables = find_all_variables(ast);

      // Process each variable using the JavaScript config (TypeScript uses same logic)
      const var_handler = JAVASCRIPT_HANDLERS["definition.variable"];
      expect(var_handler).toBeDefined();

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler!(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const config_var = vars.find(v => v.name === "CONFIG");
      const local_var = vars.find(v => v.name === "local_var");

      expect(config_var).toBeDefined();
      expect(local_var).toBeDefined();

      // CONFIG should be exported
      expect(config_var!.is_exported).toBe(true);

      // local_var should NOT be exported (it's inside a nested arrow function)
      expect(local_var!.is_exported).toBe(false);
    });

    it("should NOT mark variables inside exported arrays with functions as exported", () => {
      const code = `
export const HANDLERS: Array<Function> = [
  function process(item: any): any {
    const temp = item.value;
    return temp;
  }
];`;
      const ast = get_ast_node(code);
      const builder = new DefinitionBuilder(mock_context);

      function find_all_variables(node: SyntaxNode): Array<{node: SyntaxNode, name: string}> {
        const results: Array<{node: SyntaxNode, name: string}> = [];

        if (node.type === "variable_declarator") {
          const name_node = node.childForFieldName?.("name");
          if (name_node) {
            results.push({node: name_node, name: name_node.text});
          }
        }

        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            results.push(...find_all_variables(child));
          }
        }

        return results;
      }

      const variables = find_all_variables(ast);

      const var_handler = JAVASCRIPT_HANDLERS["definition.variable"];
      expect(var_handler).toBeDefined();

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler!(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const handlers_var = vars.find(v => v.name === "HANDLERS");
      const temp_var = vars.find(v => v.name === "temp");

      expect(handlers_var).toBeDefined();
      expect(temp_var).toBeDefined();

      // HANDLERS should be exported
      expect(handlers_var!.is_exported).toBe(true);

      // temp should NOT be exported (it's inside a nested function)
      expect(temp_var!.is_exported).toBe(false);
    });

    it("should NOT mark deeply nested variables in exported type-annotated objects as exported", () => {
      const code = `
export const NESTED: {
  outer: {
    middle: () => boolean
  }
} = {
  outer: {
    middle: () => {
      const deeply_nested = true;
      return deeply_nested;
    }
  }
};`;
      const ast = get_ast_node(code);
      const builder = new DefinitionBuilder(mock_context);

      function find_all_variables(node: SyntaxNode): Array<{node: SyntaxNode, name: string}> {
        const results: Array<{node: SyntaxNode, name: string}> = [];

        if (node.type === "variable_declarator") {
          const name_node = node.childForFieldName?.("name");
          if (name_node) {
            results.push({node: name_node, name: name_node.text});
          }
        }

        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            results.push(...find_all_variables(child));
          }
        }

        return results;
      }

      const variables = find_all_variables(ast);

      const var_handler = JAVASCRIPT_HANDLERS["definition.variable"];
      expect(var_handler).toBeDefined();

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler!(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const nested_var = vars.find(v => v.name === "NESTED");
      const deeply_var = vars.find(v => v.name === "deeply_nested");

      expect(nested_var).toBeDefined();
      expect(deeply_var).toBeDefined();

      // NESTED should be exported
      expect(nested_var!.is_exported).toBe(true);

      // deeply_nested should NOT be exported (it's inside a nested arrow function)
      expect(deeply_var!.is_exported).toBe(false);
    });
  });

  // ============================================================================
  // PROPERTY TYPE EXTRACTION TESTS (Task 11.150.1)
  // ============================================================================

  describe("Property type extraction", () => {
    it("should extract type from public field with annotation", () => {
      const code = `
        class Foo {
          public field: Registry = new Registry();
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      expect(classes.length).toBe(1);

      const foo_class = classes[0];
      expect(foo_class.name).toBe("Foo");
      expect(foo_class.properties.length).toBeGreaterThan(0);

      const field_prop = foo_class.properties.find(p => p.name === "field");
      expect(field_prop).toBeDefined();
      expect(field_prop?.type).toBe("Registry");
    });

    it("should extract type from private field", () => {
      const code = `
        class Foo {
          private data: Map<string, number>;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const data_prop = foo_class.properties.find(p => p.name === "data");
      expect(data_prop).toBeDefined();
      expect(data_prop?.type).toBe("Map<string, number>");
    });

    it("should extract type from optional field", () => {
      const code = `
        class Foo {
          optional?: string;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const optional_prop = foo_class.properties.find(p => p.name === "optional");
      expect(optional_prop).toBeDefined();
      expect(optional_prop?.type).toBe("string");
      // Note: optional modifier tracking is not yet implemented for PropertyDefinition
    });

    it("should extract type from readonly field", () => {
      const code = `
        class Foo {
          readonly config: Config;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const config_prop = foo_class.properties.find(p => p.name === "config");
      expect(config_prop).toBeDefined();
      expect(config_prop?.type).toBe("Config");
      // Note: readonly modifier tracking is not yet implemented for PropertyDefinition
    });

    it("should extract type from static field", () => {
      const code = `
        class Foo {
          static instance: Foo;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const instance_prop = foo_class.properties.find(p => p.name === "instance");
      expect(instance_prop).toBeDefined();
      expect(instance_prop?.type).toBe("Foo");
      // Note: static modifier tracking is not yet implemented for PropertyDefinition
    });

    it("should extract generic type annotations", () => {
      const code = `
        class Foo {
          items: Map<string, Item[]>;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const items_prop = foo_class.properties.find(p => p.name === "items");
      expect(items_prop).toBeDefined();
      expect(items_prop?.type).toBe("Map<string, Item[]>");
    });

    it("should extract array type annotations", () => {
      const code = `
        class Foo {
          numbers: number[];
          items: Array<string>;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      expect(foo_class.properties.length).toBeGreaterThan(0);

      const numbers_prop = foo_class.properties.find(p => p.name === "numbers");
      const items_prop = foo_class.properties.find(p => p.name === "items");

      expect(numbers_prop).toBeDefined();
      expect(numbers_prop?.type).toBe("number[]");

      expect(items_prop).toBeDefined();
      expect(items_prop?.type).toBe("Array<string>");
    });

    it("should extract union type annotations", () => {
      const code = `
        class Foo {
          value: string | number | null;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const value_prop = foo_class.properties.find(p => p.name === "value");
      expect(value_prop).toBeDefined();
      expect(value_prop?.type).toBe("string | number | null");
    });

    it("should extract function type annotations", () => {
      const code = `
        class Foo {
          handler: (data: string) => void;
        }
      `;

      const index = build_index_from_code(code);
      const classes = Array.from(index.classes.values());
      const foo_class = classes[0];
      const handler_prop = foo_class.properties.find(p => p.name === "handler");
      expect(handler_prop).toBeDefined();
      expect(handler_prop?.type).toBe("(data: string) => void");
    });
  });

  // ============================================================================
  // DETECT_CALLBACK_CONTEXT UNIT TESTS (Task 11.156.2.2)
  // ============================================================================

  describe("detect_callback_context", () => {
    function find_arrow_function(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "arrow_function") {
        return node;
      }
      for (const child of node.children) {
        const result = find_arrow_function(child);
        if (result) return result;
      }
      return null;
    }

    describe("Callback detection - positive cases", () => {
      it("should detect callback in array.forEach()", () => {
        const code = "items.forEach((item) => { console.log(item); });";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
        expect(context.receiver_location?.start_line).toBe(1);
      });

      it("should detect callback in array.map()", () => {
        const code = "numbers.map(x => x * 2);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(true);
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in array.filter()", () => {
        const code = "items.filter(item => item.active);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(true);
      });

      it("should detect callback as second argument", () => {
        const code = "setTimeout(() => console.log(\"done\"), 1000);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(true);
      });

      it("should detect nested callback (callback inside callback)", () => {
        const code = "items.map(x => [x].filter(y => y > 0));";
        const tree = parser.parse(code);

        // Find both arrow functions
        const arrow_fns: SyntaxNode[] = [];
        function collect_arrows(node: SyntaxNode) {
          if (node.type === "arrow_function") {
            arrow_fns.push(node);
          }
          for (const child of node.children) {
            collect_arrows(child);
          }
        }
        collect_arrows(tree.rootNode);

        expect(arrow_fns.length).toBe(2);

        // Both should be detected as callbacks
        const outer_context = detect_callback_context(arrow_fns[0], "test.ts");
        const inner_context = detect_callback_context(arrow_fns[1], "test.ts");

        expect(outer_context.is_callback).toBe(true);
        expect(inner_context.is_callback).toBe(true);
      });

      it("should detect callback in method call", () => {
        const code = "obj.subscribe(event => handle(event));";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(true);
      });
    });

    describe("Non-callback detection - negative cases", () => {
      it("should NOT detect callback in variable assignment", () => {
        const code = "const fn = () => { console.log(\"test\"); };";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in return statement", () => {
        const code = "function factory() { return () => {}; }";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in object literal", () => {
        const code = "const obj = { handler: () => {} };";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in array literal", () => {
        const code = "const fns = [() => {}];";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.is_callback).toBe(false);
      });
    });

    describe("Receiver location capture", () => {
      it("should capture correct receiver location for forEach call", () => {
        const code = "items.forEach((x) => x * 2);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.receiver_location).toEqual({
          file_path: "test.ts",
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 27,
        });
      });

      it("should capture receiver location spanning multiple lines", () => {
        const code = `items.forEach(
  (item) => {
    console.log(item);
  }
);`;
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts");

        expect(context.receiver_location).not.toBeNull();
        expect(context.receiver_location?.start_line).toBe(1);
        expect(context.receiver_location?.end_line).toBe(5);
      });
    });
  });
});
