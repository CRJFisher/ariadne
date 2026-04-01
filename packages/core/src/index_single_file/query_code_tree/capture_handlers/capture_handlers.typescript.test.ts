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
import { DefinitionBuilder } from "../../definitions/definitions";
import { build_index_single_file } from "../../index_single_file";
import { node_to_location } from "../../node_utils";
import type { ParsedFile } from "../../file_utils";
import type {
  ProcessingContext,
  CaptureNode,
  SemanticEntity,
  SemanticCategory,
} from "../../index_single_file";
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

  // Helper to create a raw capture using node_to_location for consistent location encoding
  function create_raw_capture(
    name: string,
    node: SyntaxNode,
    text?: string
  ): CaptureNode {
    const parts = name.split(".");
    return {
      name,
      node,
      text: (text || node.text) as SymbolName,
      category: (parts[0] || "definition") as SemanticCategory,
      entity: (parts[1] || "interface") as SemanticEntity,
      location: node_to_location(node, "test.ts" as FilePath),
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
    return build_index_single_file(parsed_file, tree, "typescript");
  }

  describe("TYPESCRIPT_HANDLERS", () => {
    it("should contain all expected handler keys", () => {
      const expected_keys = [
        // Inherited from JavaScript
        "definition.variable",
        "definition.function",
        "definition.anonymous_function",
        "definition.class",
        "definition.method",
        "definition.field",
        "definition.parameter",
        // TypeScript-specific: Interfaces
        "definition.interface",
        "definition.interface.method",
        "definition.interface.property",
        // TypeScript-specific: Type aliases
        "definition.type_alias",
        // TypeScript-specific: Enums
        "definition.enum",
        "definition.enum.member",
        // TypeScript-specific: Namespaces
        "definition.namespace",
        // TypeScript-specific: Decorators
        "decorator.class",
        "decorator.method",
        "decorator.property",
        // TypeScript-specific: Methods
        "definition.method.private",
        "definition.method.abstract",
        // TypeScript-specific: Fields
        "definition.field.private",
        "definition.field.param_property",
        // TypeScript-specific: Parameters
        "definition.parameter.optional",
        "definition.parameter.rest",
      ];

      for (const key of expected_keys) {
        expect(key in TYPESCRIPT_HANDLERS).toBe(true);
        expect(typeof TYPESCRIPT_HANDLERS[key]).toBe("function");
      }

      // Verify expected keys are a subset (there may be additional inherited JS handlers)
      expect(Object.keys(TYPESCRIPT_HANDLERS).length).toBeGreaterThanOrEqual(expected_keys.length);
    });

    it("should extend JavaScript configuration with all JS keys present", () => {
      const js_keys = Object.keys(JAVASCRIPT_HANDLERS);
      for (const key of js_keys) {
        expect(key in TYPESCRIPT_HANDLERS).toBe(true);
      }
      // TypeScript has more handlers than JavaScript
      expect(Object.keys(TYPESCRIPT_HANDLERS).length).toBeGreaterThan(
        Object.keys(JAVASCRIPT_HANDLERS).length
      );
    });
  });

  describe("Interface handling", () => {
    it("should process interface definitions", () => {
      const code = `interface IUser {
  name: string;
  age: number;
}`;
      const ast = get_ast_node(code);
      const interface_node = find_node_by_type(ast, "interface_declaration")!;
      const name_node = interface_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.interface"];
      const capture = create_raw_capture("definition.interface", name_node, "IUser");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.interfaces.size).toBe(1);
      const iface = Array.from(result.interfaces.values())[0];
      expect(iface.kind).toBe("interface");
      expect(iface.name).toBe("IUser");
      expect(iface.is_exported).toBe(false);
      expect(iface.extends).toEqual([]);
      expect(iface.methods).toEqual([]);
      expect(iface.properties).toEqual([]);
    });

    it("should process interface with extends", () => {
      const code = "interface IAdmin extends IUser, ISerializable {}";
      const index = build_index_from_code(code);
      const iface = Array.from(index.interfaces.values()).find(i => i.name === "IAdmin")!;
      expect(iface.kind).toBe("interface");
      expect(iface.name).toBe("IAdmin");
      expect(iface.extends).toEqual(["IUser", "ISerializable"]);
    });

    it("should process interface method signatures via integration", () => {
      const code = `interface ICalculator {
  add(a: number, b: number): number;
}`;
      const index = build_index_from_code(code);
      const iface = Array.from(index.interfaces.values()).find(i => i.name === "ICalculator")!;
      expect(iface.kind).toBe("interface");
      expect(iface.methods.length).toBe(1);
      const method = iface.methods[0];
      expect(method.name).toBe("add");
      expect(method.kind).toBe("method");
      expect(method.return_type).toBe("number");
    });

    it("should process interface property signatures via integration", () => {
      const code = `interface IConfig {
  debug: boolean;
  name: string;
}`;
      const index = build_index_from_code(code);
      const iface = Array.from(index.interfaces.values()).find(i => i.name === "IConfig")!;
      expect(iface.kind).toBe("interface");
      expect(iface.properties.length).toBe(2);
      const debug_prop = iface.properties.find(p => p.name === "debug")!;
      expect(debug_prop.kind).toBe("property");
      expect(debug_prop.type).toBe("boolean");
      const name_prop = iface.properties.find(p => p.name === "name")!;
      expect(name_prop.kind).toBe("property");
      expect(name_prop.type).toBe("string");
    });
  });

  describe("Type alias handling", () => {
    it("should process type alias definitions", () => {
      const code = "type UserID = string | number;";
      const ast = get_ast_node(code);
      const type_alias_node = find_node_by_type(ast, "type_alias_declaration")!;
      const name_node = type_alias_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.type_alias"];
      const capture = create_raw_capture("definition.type_alias", name_node, "UserID");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.types.size).toBe(1);
      const type_alias = Array.from(result.types.values())[0];
      expect(type_alias.kind).toBe("type_alias");
      expect(type_alias.name).toBe("UserID");
      expect(type_alias.is_exported).toBe(false);
      expect(type_alias.type_expression).toBe("string | number");
    });

    it("should process generic type aliases", () => {
      const code = "type Result<T, E> = { ok: T } | { error: E };";
      const ast = get_ast_node(code);
      const type_alias_node = find_node_by_type(ast, "type_alias_declaration")!;
      const name_node = type_alias_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.type_alias"];
      const capture = create_raw_capture("definition.type_alias", name_node, "Result");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.types.size).toBe(1);
      const type_alias = Array.from(result.types.values())[0];
      expect(type_alias.kind).toBe("type_alias");
      expect(type_alias.name).toBe("Result");
      expect(type_alias.generics).toEqual(["T", "E"]);
    });

    it("should process exported type alias via integration", () => {
      const code = "export type StatusCode = 200 | 404 | 500;";
      const index = build_index_from_code(code);
      const type_alias = Array.from(index.types.values()).find(t => t.name === "StatusCode")!;
      expect(type_alias.kind).toBe("type_alias");
      expect(type_alias.name).toBe("StatusCode");
      expect(type_alias.is_exported).toBe(true);
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
      const enum_node = find_node_by_type(ast, "enum_declaration")!;
      const name_node = enum_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.enum"];
      const capture = create_raw_capture("definition.enum", name_node, "Color");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.enums.size).toBe(1);
      const enum_def = Array.from(result.enums.values())[0];
      expect(enum_def.kind).toBe("enum");
      expect(enum_def.name).toBe("Color");
      expect(enum_def.is_const).toBe(false);
      expect(enum_def.is_exported).toBe(false);
      expect(enum_def.members).toEqual([]);
    });

    it("should process const enum definitions", () => {
      const code = `const enum Status {
  Active,
  Inactive
}`;
      const ast = get_ast_node(code);
      const enum_node = find_node_by_type(ast, "enum_declaration")!;
      const name_node = enum_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.enum"];
      const capture = create_raw_capture("definition.enum", name_node, "Status");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.enums.size).toBe(1);
      const enum_def = Array.from(result.enums.values())[0];
      expect(enum_def.kind).toBe("enum");
      expect(enum_def.name).toBe("Status");
      expect(enum_def.is_const).toBe(true);
    });

    it("should process enum with members via integration", () => {
      const code = `enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT"
}`;
      const index = build_index_from_code(code);
      const enum_def = Array.from(index.enums.values()).find(e => e.name === "Direction")!;
      expect(enum_def.kind).toBe("enum");
      expect(enum_def.is_const).toBe(false);
      expect(enum_def.is_exported).toBe(false);
      // Enum members are captured via definition.enum.member handler and
      // attached via find_containing_enum.
      expect(enum_def.members.map(m => m.name)).toEqual(["Up", "Down", "Left", "Right"]);
      expect(enum_def.members.map(m => m.value)).toEqual(["\"UP\"", "\"DOWN\"", "\"LEFT\"", "\"RIGHT\""]);
    });

    it("should process exported enum via integration", () => {
      const code = "export enum LogLevel { Debug, Info, Warn, Error }";
      const index = build_index_from_code(code);
      const enum_def = Array.from(index.enums.values()).find(e => e.name === "LogLevel")!;
      expect(enum_def.is_exported).toBe(true);
      expect(enum_def.kind).toBe("enum");
    });
  });

  describe("Namespace handling", () => {
    it("should process namespace definitions", () => {
      const code = `namespace Utils {
  export function log(msg: string): void {}
}`;
      const ast = get_ast_node(code);
      const namespace_node = find_node_by_type(ast, "internal_module")!;
      const name_node = namespace_node.childForFieldName!("name")!;

      const builder = new DefinitionBuilder(mock_context);
      const handler = TYPESCRIPT_HANDLERS["definition.namespace"];
      const capture = create_raw_capture("definition.namespace", name_node, "Utils");
      handler(capture, builder, mock_context);

      const result = builder.build();
      expect(result.namespaces.size).toBe(1);
      const namespace_def = Array.from(result.namespaces.values())[0];
      expect(namespace_def.kind).toBe("namespace");
      expect(namespace_def.name).toBe("Utils");
      expect(namespace_def.is_exported).toBe(false);
    });
  });

  describe("Class enhancements", () => {
    it("should process abstract classes via integration", () => {
      const code = `abstract class Shape {
  abstract area(): number;
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Shape")!;
      expect(cls.kind).toBe("class");
      expect(cls.name).toBe("Shape");
      expect(cls.is_exported).toBe(false);
      expect(cls.methods.length).toBe(1);
      expect(cls.methods[0]!.name).toBe("area");
      expect(cls.methods[0]!.abstract).toBe(true);
      expect(cls.methods[0]!.return_type).toBe("number");
    });

    it("should process classes with implements via integration", () => {
      const code = `class User implements IUser, ISerializable {
  name: string = "";
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "User")!;
      expect(cls.kind).toBe("class");
      expect(cls.name).toBe("User");
      expect(cls.extends).toEqual(["IUser", "ISerializable"]);
    });

    it("should process classes with extends and implements via integration", () => {
      const code = `class Admin extends BaseUser implements IAdmin {
  role: string = "admin";
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Admin")!;
      expect(cls.extends).toEqual(["BaseUser", "IAdmin"]);
    });

    it("should process generic classes via integration", () => {
      const code = `class Container<T> {
  private value: T = {} as T;
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Container")!;
      expect(cls.kind).toBe("class");
      expect(cls.name).toBe("Container");
      expect(cls.generics).toEqual(["T"]);
    });

    it("should process exported class via integration", () => {
      const code = "export class Service { run() {} }";
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Service")!;
      expect(cls.is_exported).toBe(true);
      expect(cls.methods.length).toBe(1);
      expect(cls.methods[0].name).toBe("run");
    });
  });

  describe("Method handling via integration", () => {
    it("should process class methods", () => {
      const code = `class Calculator {
  add(a: number, b: number): number { return a + b; }
  subtract(a: number, b: number): number { return a - b; }
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Calculator")!;
      expect(cls.methods.length).toBe(2);

      const add = cls.methods.find(m => m.name === "add")!;
      expect(add.kind).toBe("method");
      expect(add.return_type).toBe("number");
      expect(add.parameters.length).toBe(2);
      expect(add.parameters[0].name).toBe("a");
      expect(add.parameters[0].type).toBe("number");
      expect(add.parameters[1].name).toBe("b");

      const sub = cls.methods.find(m => m.name === "subtract")!;
      expect(sub.return_type).toBe("number");
    });

    it("should process async methods", () => {
      const code = `class Api {
  async fetch(url: string): Promise<Response> { return new Response(); }
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Api")!;
      const method = cls.methods.find(m => m.name === "fetch")!;
      expect(method.return_type).toBe("Promise<Response>");
      expect(method.async).toBe(true);
    });

    it("should process static methods", () => {
      const code = `class Factory {
  static create(): Factory { return new Factory(); }
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Factory")!;
      const method = cls.methods.find(m => m.name === "create")!;
      expect(method.static).toBe(true);
    });
  });

  describe("Decorator handling", () => {
    it("should have decorator handler functions registered", () => {
      expect(typeof TYPESCRIPT_HANDLERS["decorator.class"]).toBe("function");
      expect(typeof TYPESCRIPT_HANDLERS["decorator.method"]).toBe("function");
      expect(typeof TYPESCRIPT_HANDLERS["decorator.property"]).toBe("function");
    });

    it("should process class decorator when target is found", () => {
      // Decorator handlers require the class to exist in the builder first.
      // Use direct handler invocation with a pre-registered class.
      const code = `@Component
class MyComponent {
  value: number = 0;
}`;
      const ast = get_ast_node(code);
      const builder = new DefinitionBuilder(mock_context);

      // First register the class
      const class_name_node = find_node_by_type(ast, "type_identifier")!;
      const class_capture = create_raw_capture("definition.class", class_name_node, "MyComponent");
      TYPESCRIPT_HANDLERS["definition.class"](class_capture, builder, mock_context);

      // The decorator identifier is inside the decorator node
      const decorator_node = find_node_by_type(ast, "decorator")!;
      const decorator_id_node = find_node_by_type(decorator_node, "identifier")!;
      const decorator_capture = create_raw_capture("decorator.class", decorator_id_node, "Component");

      // Invoke the handler - it calls find_decorator_target which walks
      // from the identifier up to the decorator node, then to class_declaration
      TYPESCRIPT_HANDLERS["decorator.class"](decorator_capture, builder, mock_context);

      const result = builder.build();
      const cls = Array.from(result.classes.values())[0];
      expect(cls.kind).toBe("class");
      expect(cls.name).toBe("MyComponent");
      expect(cls.decorators.length).toBe(1);
      expect(cls.decorators[0].name).toBe("Component");
    });
  });

  describe("Access modifiers via integration", () => {
    it("should handle private members", () => {
      const code = `class Account {
  private balance: number = 0;
  private updateBalance() {}
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Account")!;

      const balance_prop = cls.properties.find(p => p.name === "balance")!;
      expect(balance_prop.access_modifier).toBe("private");

      const update_method = cls.methods.find(m => m.name === "updateBalance")!;
      expect(update_method.access_modifier).toBe("private");
    });

    it("should handle protected members", () => {
      const code = `class Base {
  protected data: string = "";
  protected process() {}
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Base")!;

      const data_prop = cls.properties.find(p => p.name === "data")!;
      expect(data_prop.access_modifier).toBe("protected");

      const process_method = cls.methods.find(m => m.name === "process")!;
      expect(process_method.access_modifier).toBe("protected");
    });

    it("should handle readonly properties", () => {
      const code = `class Config {
  readonly version: string = "1.0";
}`;
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Config")!;
      // readonly is set internally but not exposed on PropertyDefinition as a top-level field
      // Check the property exists with correct type
      const version_prop = cls.properties.find(p => p.name === "version")!;
      expect(version_prop.kind).toBe("property");
      expect(version_prop.type).toBe("string");
    });
  });

  describe("Function handling via integration", () => {
    it("should process named function declarations", () => {
      const code = "function greet(name: string): string { return \"Hello \" + name; }";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "greet")!;
      expect(fn.kind).toBe("function");
      expect(fn.name).toBe("greet");
      expect(fn.is_exported).toBe(false);
      expect(fn.return_type).toBe("string");
      expect(fn.signature.parameters.length).toBe(1);
      expect(fn.signature.parameters[0].name).toBe("name");
      expect(fn.signature.parameters[0].type).toBe("string");
    });

    it("should process exported functions", () => {
      const code = "export function process(): void {}";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "process")!;
      expect(fn.is_exported).toBe(true);
      expect(fn.return_type).toBe("void");
    });

    it("should process arrow function assigned to variable", () => {
      const code = "const add = (a: number, b: number): number => a + b;";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "add")!;
      expect(fn.kind).toBe("function");
      expect(fn.name).toBe("add");
      // Return type for arrow functions assigned to variables is captured
      // on the arrow function node, not the variable name node
      expect(fn.is_exported).toBe(false);
    });
  });

  describe("Anonymous function handling via integration", () => {
    it("should process anonymous arrow functions as callbacks", () => {
      const code = "function run() { items.forEach((item) => { console.log(item); }); }";
      const index = build_index_from_code(code);
      const anon_fns = Array.from(index.functions.values()).filter(f => f.name === "<anonymous>");
      expect(anon_fns.length).toBe(1);
      expect(anon_fns[0].callback_context?.is_callback).toBe(true);
    });
  });

  describe("Parameter handling via integration", () => {
    it("should process required parameters", () => {
      const code = "function greet(name: string, count: number): void {}";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "greet")!;
      expect(fn.signature.parameters.length).toBe(2);
      expect(fn.signature.parameters[0].name).toBe("name");
      expect(fn.signature.parameters[0].type).toBe("string");
      expect(fn.signature.parameters[1].name).toBe("count");
      expect(fn.signature.parameters[1].type).toBe("number");
    });

    it("should process optional parameters", () => {
      const code = "function greet(name: string, suffix?: string): void {}";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "greet")!;
      expect(fn.signature.parameters.length).toBe(2);
      expect(fn.signature.parameters[1].name).toBe("suffix");
      expect(fn.signature.parameters[1].type).toBe("string");
    });

    it("should process rest parameters", () => {
      const code = "function sum(...values: number[]): number { return values.reduce((a, b) => a + b, 0); }";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "sum")!;
      expect(fn.signature.parameters.length).toBe(1);
      expect(fn.signature.parameters[0].name).toBe("values");
      expect(fn.signature.parameters[0].type).toBe("number[]");
    });

    it("should process parameters with default values", () => {
      const code = "function greet(name: string = \"World\"): void {}";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "greet")!;
      expect(fn.signature.parameters.length).toBe(1);
      expect(fn.signature.parameters[0].name).toBe("name");
      expect(fn.signature.parameters[0].type).toBe("string");
      expect(fn.signature.parameters[0].default_value).toBe("\"World\"");
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

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const config_var = vars.find(v => v.name === "CONFIG")!;
      const local_var = vars.find(v => v.name === "local_var")!;

      // CONFIG should be exported
      expect(config_var.kind).toBe("constant");
      expect(config_var.is_exported).toBe(true);

      // local_var should NOT be exported (it's inside a nested arrow function)
      expect(local_var.kind).toBe("constant");
      expect(local_var.is_exported).toBe(false);
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

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const handlers_var = vars.find(v => v.name === "HANDLERS")!;
      const temp_var = vars.find(v => v.name === "temp")!;

      // HANDLERS should be exported
      expect(handlers_var.kind).toBe("constant");
      expect(handlers_var.is_exported).toBe(true);

      // temp should NOT be exported (it's inside a nested function)
      expect(temp_var.kind).toBe("constant");
      expect(temp_var.is_exported).toBe(false);
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

      for (const {node, name} of variables) {
        const capture = create_raw_capture("definition.variable", node, name);
        var_handler(capture, builder, mock_context);
      }

      const result = builder.build();
      const vars = Array.from(result.variables.values());

      expect(vars.length).toBe(2);

      const nested_var = vars.find(v => v.name === "NESTED")!;
      const deeply_var = vars.find(v => v.name === "deeply_nested")!;

      // NESTED should be exported
      expect(nested_var.kind).toBe("constant");
      expect(nested_var.is_exported).toBe(true);

      // deeply_nested should NOT be exported (it's inside a nested arrow function)
      expect(deeply_var.kind).toBe("constant");
      expect(deeply_var.is_exported).toBe(false);
    });
  });

  // ============================================================================
  // FACTORY PATTERN TYPE INFERENCE TESTS (Task 11.167)
  // ============================================================================

  describe("Factory pattern type inference", () => {
    it("should extract initialized_from_call for variables assigned from function calls", () => {
      const code = `
function createHandler(): Handler {
  return new HandlerA();
}

function use() {
  const h = createHandler();
  h.process();
}`;
      const index = build_index_from_code(code);
      const vars = Array.from(index.variables.values());

      const h_var = vars.find(v => v.name === "h")!;
      expect(h_var.kind).toBe("constant");
      expect(h_var.initialized_from_call).toBe("createHandler");
    });

    it("should NOT set initialized_from_call for variables with literal initializers", () => {
      const code = `
const x = 42;
const y = "hello";
const z = { a: 1 };
`;
      const index = build_index_from_code(code);
      const vars = Array.from(index.variables.values());

      for (const v of vars) {
        expect(v.initialized_from_call).toBeUndefined();
      }
    });

    it("should extract initialized_from_call for const declarations", () => {
      const code = `
const extractor = get_scope_boundary_extractor(language);
`;
      const index = build_index_from_code(code);
      const vars = Array.from(index.variables.values());

      const extractor_var = vars.find(v => v.name === "extractor")!;
      expect(extractor_var.kind).toBe("constant");
      expect(extractor_var.initialized_from_call).toBe("get_scope_boundary_extractor");
    });

    it("should NOT set initialized_from_call for method calls on objects", () => {
      const code = `
const result = obj.getSomething();
`;
      const index = build_index_from_code(code);
      const vars = Array.from(index.variables.values());

      const result_var = vars.find(v => v.name === "result")!;
      expect(result_var.kind).toBe("constant");
      // Method calls on objects (property access) should not set initialized_from_call
      // Only direct function calls should be tracked
      expect(result_var.initialized_from_call).toBeUndefined();
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
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;

      const field_prop = foo_class.properties.find(p => p.name === "field")!;
      expect(field_prop.kind).toBe("property");
      expect(field_prop.type).toBe("Registry");
      expect(field_prop.access_modifier).toBe("public");
    });

    it("should extract type from private field", () => {
      const code = `
        class Foo {
          private data: Map<string, number>;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const data_prop = foo_class.properties.find(p => p.name === "data")!;
      expect(data_prop.kind).toBe("property");
      expect(data_prop.type).toBe("Map<string, number>");
      expect(data_prop.access_modifier).toBe("private");
    });

    it("should extract type from optional field", () => {
      const code = `
        class Foo {
          optional?: string;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const optional_prop = foo_class.properties.find(p => p.name === "optional")!;
      expect(optional_prop.kind).toBe("property");
      expect(optional_prop.type).toBe("string");
    });

    it("should extract type from readonly field", () => {
      const code = `
        class Foo {
          readonly config: Config;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const config_prop = foo_class.properties.find(p => p.name === "config")!;
      expect(config_prop.kind).toBe("property");
      expect(config_prop.type).toBe("Config");
    });

    it("should extract type from static field", () => {
      const code = `
        class Foo {
          static instance: Foo;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const instance_prop = foo_class.properties.find(p => p.name === "instance")!;
      expect(instance_prop.kind).toBe("property");
      expect(instance_prop.type).toBe("Foo");
    });

    it("should extract generic type annotations", () => {
      const code = `
        class Foo {
          items: Map<string, Item[]>;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const items_prop = foo_class.properties.find(p => p.name === "items")!;
      expect(items_prop.kind).toBe("property");
      expect(items_prop.type).toBe("Map<string, Item[]>");
    });

    it("should extract array type annotations", () => {
      const code = `
        class Foo {
          numbers: number[];
          items: Array<string>;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;

      const numbers_prop = foo_class.properties.find(p => p.name === "numbers")!;
      expect(numbers_prop.type).toBe("number[]");

      const items_prop = foo_class.properties.find(p => p.name === "items")!;
      expect(items_prop.type).toBe("Array<string>");
    });

    it("should extract union type annotations", () => {
      const code = `
        class Foo {
          value: string | number | null;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const value_prop = foo_class.properties.find(p => p.name === "value")!;
      expect(value_prop.kind).toBe("property");
      expect(value_prop.type).toBe("string | number | null");
    });

    it("should extract function type annotations", () => {
      const code = `
        class Foo {
          handler: (data: string) => void;
        }
      `;

      const index = build_index_from_code(code);
      const foo_class = Array.from(index.classes.values()).find(c => c.name === "Foo")!;
      const handler_prop = foo_class.properties.find(p => p.name === "handler")!;
      expect(handler_prop.kind).toBe("property");
      expect(handler_prop.type).toBe("(data: string) => void");
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
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

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
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(true);
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in array.filter()", () => {
        const code = "items.filter(item => item.active);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(true);
      });

      it("should detect callback as second argument", () => {
        const code = "setTimeout(() => console.log(\"done\"), 1000);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

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
        const outer_context = detect_callback_context(arrow_fns[0], "test.ts" as FilePath);
        const inner_context = detect_callback_context(arrow_fns[1], "test.ts" as FilePath);

        expect(outer_context.is_callback).toBe(true);
        expect(inner_context.is_callback).toBe(true);
      });

      it("should detect callback in method call", () => {
        const code = "obj.subscribe(event => handle(event));";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(true);
      });
    });

    describe("Non-callback detection - negative cases", () => {
      it("should NOT detect callback in variable assignment", () => {
        const code = "const fn = () => { console.log(\"test\"); };";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in return statement", () => {
        const code = "function factory() { return () => {}; }";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in object literal", () => {
        const code = "const obj = { handler: () => {} };";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(false);
      });

      it("should NOT detect callback in array literal", () => {
        const code = "const fns = [() => {}];";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.is_callback).toBe(false);
      });
    });

    describe("Receiver location capture", () => {
      it("should capture correct receiver location for forEach call", () => {
        const code = "items.forEach((x) => x * 2);";
        const tree = parser.parse(code);
        const arrow_fn = find_arrow_function(tree.rootNode);

        expect(arrow_fn).not.toBeNull();
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.receiver_location).toEqual({
          file_path: "test.ts" as FilePath,
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
        const context = detect_callback_context(arrow_fn!, "test.ts" as FilePath);

        expect(context.receiver_location).not.toBeNull();
        expect(context.receiver_location?.start_line).toBe(1);
        expect(context.receiver_location?.end_line).toBe(5);
      });
    });
  });

  describe("TypeScript docstring extraction", () => {
    it("should extract JSDoc on a function", () => {
      const code = "/** Compute the total. */\nfunction total(a: number): number { return a; }";
      const index = build_index_from_code(code);
      const fn = Array.from(index.functions.values()).find(f => f.name === "total")!;
      expect(fn.kind).toBe("function");
      expect(fn.docstring).toContain("Compute the total.");
    });

    it("should extract JSDoc on a class", () => {
      const code = "/** A user entity. */\nclass User { name: string = \"\"; }";
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "User")!;
      expect(cls.kind).toBe("class");
      expect(cls.docstring?.[0]).toContain("A user entity.");
    });

    it("should extract JSDoc on a method", () => {
      const code = "class Calc {\n  /** Add two numbers. */\n  add(a: number, b: number) { return a + b; }\n}";
      const index = build_index_from_code(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Calc")!;
      const method = cls.methods.find(m => m.name === "add")!;
      expect(method.kind).toBe("method");
      expect(method.docstring).toContain("Add two numbers.");
    });

    it("should extract JSDoc on a const variable", () => {
      const code = "/** @type {Service} */\nconst svc = create_service();";
      const index = build_index_from_code(code);
      const variable = Array.from(index.variables.values()).find(v => v.name === "svc")!;
      expect(variable.kind).toBe("constant");
      expect(variable.docstring).toContain("@type {Service}");
    });
  });
});
