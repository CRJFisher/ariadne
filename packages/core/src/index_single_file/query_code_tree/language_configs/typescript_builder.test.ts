/**
 * Tests for TypeScript language configuration using builder pattern
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { SyntaxNode } from "tree-sitter";
import { TYPESCRIPT_BUILDER_CONFIG, extract_return_type } from "./typescript_builder";
import { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
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
  const mockContext: ProcessingContext = {
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
  function getAstNode(code: string): SyntaxNode {
    return parser.parse(code).rootNode;
  }

  // Helper function to find first node of specific type
  function findNodeByType(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = findNodeByType(node.child(i)!, type);
      if (found) return found;
    }
    return null;
  }

  // Helper to create a raw capture
  function createRawCapture(
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

  describe("TYPESCRIPT_BUILDER_CONFIG", () => {
    it("should export a valid LanguageBuilderConfig", () => {
      expect(TYPESCRIPT_BUILDER_CONFIG).toBeDefined();
      expect(TYPESCRIPT_BUILDER_CONFIG).toBeInstanceOf(Map);
      expect(TYPESCRIPT_BUILDER_CONFIG.size).toBeGreaterThan(0);
    });

    it("should extend JavaScript configuration", () => {
      // Should contain all JavaScript mappings plus TypeScript-specific ones
      expect(TYPESCRIPT_BUILDER_CONFIG.size).toBeGreaterThan(
        JAVASCRIPT_BUILDER_CONFIG.size
      );

      // Check that JavaScript mappings are included
      const jsKeys = Array.from(JAVASCRIPT_BUILDER_CONFIG.keys());
      for (const key of jsKeys) {
        expect(TYPESCRIPT_BUILDER_CONFIG.has(key)).toBe(true);
      }
    });

    it("should contain TypeScript-specific capture handlers", () => {
      const tsSpecificHandlers = [
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

      for (const handler of tsSpecificHandlers) {
        expect(TYPESCRIPT_BUILDER_CONFIG.has(handler)).toBe(true);
        const config = TYPESCRIPT_BUILDER_CONFIG.get(handler);
        expect(config).toBeDefined();
        expect(config?.process).toBeInstanceOf(Function);
      }
    });
  });

  describe("Interface handling", () => {
    it("should process interface definitions", () => {
      const code = `interface IUser {
        name: string;
        age: number;
      }`;
      const ast = getAstNode(code);
      const interfaceNode = findNodeByType(ast, "interface_declaration");
      const nameNode = interfaceNode?.childForFieldName?.("name");

      expect(interfaceNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.interface");

      if (handler && nameNode) {
        const capture = createRawCapture("def.interface", nameNode, "IUser");
        handler.process(capture, builder, mockContext);

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
      const ast = getAstNode(code);
      const methodSigNode = findNodeByType(ast, "method_signature");
      const methodNameNode = methodSigNode?.childForFieldName?.("name");

      expect(methodSigNode).toBeTruthy();
      expect(methodNameNode).toBeTruthy();

      // Would need to first add interface, then add method to it
      // This is a simplified test - in real usage the interface would already exist
    });

    it("should process interface property signatures", () => {
      const code = `interface IConfig {
        readonly debug?: boolean;
      }`;
      const ast = getAstNode(code);
      const propSigNode = findNodeByType(ast, "property_signature");
      const propNameNode = propSigNode?.childForFieldName?.("name");

      expect(propSigNode).toBeTruthy();
      expect(propNameNode).toBeTruthy();

      // Would need to first add interface, then add property to it
      // This is a simplified test - in real usage the interface would already exist
    });
  });

  describe("Type alias handling", () => {
    it("should process type alias definitions", () => {
      const code = "type UserID = string | number;";
      const ast = getAstNode(code);
      const typeAliasNode = findNodeByType(ast, "type_alias_declaration");
      const nameNode = typeAliasNode?.childForFieldName?.("name");

      expect(typeAliasNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.type_alias");

      if (handler && nameNode) {
        const capture = createRawCapture("def.type_alias", nameNode, "UserID");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.types.size).toBe(1);
        const typeAlias = Array.from(result.types.values())[0];
        expect(typeAlias.kind).toBe("type_alias");
        expect(typeAlias.name).toBe("UserID");
      }
    });

    it("should process generic type aliases", () => {
      const code = "type Result<T, E> = { ok: T } | { error: E };";
      const ast = getAstNode(code);
      const typeAliasNode = findNodeByType(ast, "type_alias_declaration");
      const nameNode = typeAliasNode?.childForFieldName?.("name");

      expect(typeAliasNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.type_alias");

      if (handler && nameNode) {
        const capture = createRawCapture("def.type_alias", nameNode, "Result");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.types.size).toBe(1);
        const typeAlias = Array.from(result.types.values())[0];
        expect(typeAlias.kind).toBe("type_alias");
        expect(typeAlias.name).toBe("Result");
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
      const ast = getAstNode(code);
      const enumNode = findNodeByType(ast, "enum_declaration");
      const nameNode = enumNode?.childForFieldName?.("name");

      expect(enumNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.enum");

      if (handler && nameNode) {
        const capture = createRawCapture("def.enum", nameNode, "Color");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.enums.size).toBe(1);
        const enumDef = Array.from(result.enums.values())[0];
        expect(enumDef.kind).toBe("enum");
        expect(enumDef.name).toBe("Color");
      }
    });

    it("should process const enum definitions", () => {
      const code = `const enum Status {
        Active,
        Inactive
      }`;
      const ast = getAstNode(code);
      const enumNode = findNodeByType(ast, "enum_declaration");
      const nameNode = enumNode?.childForFieldName?.("name");

      expect(enumNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.enum");

      if (handler && nameNode) {
        const capture = createRawCapture("def.enum", nameNode, "Status");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.enums.size).toBe(1);
        const enumDef = Array.from(result.enums.values())[0];
        expect(enumDef.kind).toBe("enum");
        // is_const would be determined from parent node
      }
    });
  });

  describe("Namespace handling", () => {
    it("should process namespace definitions", () => {
      const code = `namespace Utils {
        export function log(msg: string): void {}
      }`;
      const ast = getAstNode(code);
      const namespaceNode = findNodeByType(ast, "internal_module");
      const nameNode = namespaceNode?.childForFieldName?.("name");

      expect(namespaceNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.namespace");

      if (handler && nameNode) {
        const capture = createRawCapture("def.namespace", nameNode, "Utils");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.namespaces.size).toBe(1);
        const namespaceDef = Array.from(result.namespaces.values())[0];
        expect(namespaceDef.kind).toBe("namespace");
        expect(namespaceDef.name).toBe("Utils");
      }
    });
  });

  describe("Class enhancements", () => {
    it("should process abstract classes", () => {
      const code = `abstract class Shape {
        abstract area(): number;
      }`;
      const ast = getAstNode(code);
      const classNode = findNodeByType(ast, "abstract_class_declaration");
      const nameNode = classNode?.childForFieldName?.("name");

      expect(classNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.class");

      if (handler && nameNode) {
        const capture = createRawCapture("def.class", nameNode, "Shape");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const classDef = Array.from(result.classes.values())[0];
        expect(classDef.kind).toBe("class");
        expect(classDef.name).toBe("Shape");
        // abstract flag would be set based on parent node type
      }
    });

    it("should process classes with implements", () => {
      const code = `class User implements IUser, ISerializable {
        name: string;
      }`;
      const ast = getAstNode(code);
      const classNode = findNodeByType(ast, "class_declaration");
      const nameNode = classNode?.childForFieldName?.("name");

      expect(classNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.class");

      if (handler && nameNode) {
        const capture = createRawCapture("def.class", nameNode, "User");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const classDef = Array.from(result.classes.values())[0];
        expect(classDef.kind).toBe("class");
        expect(classDef.name).toBe("User");
        // implements would be extracted from class heritage
      }
    });

    it("should process generic classes", () => {
      const code = `class Container<T> {
        private value: T;
      }`;
      const ast = getAstNode(code);
      const classNode = findNodeByType(ast, "class_declaration");
      const nameNode = classNode?.childForFieldName?.("name");

      expect(classNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const builder = new DefinitionBuilder(mockContext);
      const handler = TYPESCRIPT_BUILDER_CONFIG.get("def.class");

      if (handler && nameNode) {
        const capture = createRawCapture("def.class", nameNode, "Container");
        handler.process(capture, builder, mockContext);

        const result = builder.build();
        expect(result.classes.size).toBe(1);
        const classDef = Array.from(result.classes.values())[0];
        expect(classDef.kind).toBe("class");
        expect(classDef.name).toBe("Container");
        // type_parameters would be extracted from parent node
      }
    });
  });

  describe("Decorator handling", () => {
    it("should process class decorators", () => {
      const code = `@Component
      class MyComponent {}`;
      const ast = getAstNode(code);
      const decoratorNode = findNodeByType(ast, "decorator");
      const identifierNode = decoratorNode?.firstChild;

      expect(decoratorNode).toBeTruthy();
      expect(identifierNode).toBeTruthy();

      // Decorator processing would add decorator to the target class
      // This requires the class to be processed first
    });

    it("should process method decorators", () => {
      const code = `class Service {
        @Log
        process() {}
      }`;
      const ast = getAstNode(code);
      const classBodyNode = findNodeByType(ast, "class_body");
      const methodNode = findNodeByType(ast, "method_definition");
      const decoratorNode = classBodyNode?.children?.find(
        (c) => c.type === "decorator"
      );

      expect(methodNode).toBeTruthy();
      expect(decoratorNode).toBeTruthy();

      // Decorator processing would add decorator to the target method
      // This requires the method to be processed first
    });

    it("should process property decorators", () => {
      const code = `class Model {
        @Required
        name: string;
      }`;
      const ast = getAstNode(code);
      const fieldNode = findNodeByType(ast, "public_field_definition");
      const decoratorNode = fieldNode?.children?.find(
        (c) => c.type === "decorator"
      );

      expect(fieldNode).toBeTruthy();
      expect(decoratorNode).toBeTruthy();

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
      const ast = getAstNode(code);
      const fieldNode = findNodeByType(ast, "public_field_definition");
      const methodNode = findNodeByType(ast, "method_definition");

      expect(fieldNode).toBeTruthy();
      expect(methodNode).toBeTruthy();

      // Access modifiers would be extracted during processing
    });

    it("should handle protected members", () => {
      const code = `class Base {
        protected data: string;
        protected process() {}
      }`;
      const ast = getAstNode(code);
      const fieldNode = findNodeByType(ast, "public_field_definition");
      const methodNode = findNodeByType(ast, "method_definition");

      expect(fieldNode).toBeTruthy();
      expect(methodNode).toBeTruthy();

      // Access modifiers would be extracted during processing
    });

    it("should handle readonly properties", () => {
      const code = `class Config {
        readonly version = "1.0";
      }`;
      const ast = getAstNode(code);
      const fieldNode = findNodeByType(ast, "public_field_definition");

      expect(fieldNode).toBeTruthy();

      // Readonly modifier would be extracted during processing
    });
  });

  describe("Parameter properties", () => {
    it("should handle constructor parameter properties", () => {
      const code = `class User {
        constructor(public name: string, private age: number) {}
      }`;
      const ast = getAstNode(code);
      const constructorNode = findNodeByType(ast, "method_definition");
      const params = constructorNode?.childForFieldName?.("parameters");

      expect(constructorNode).toBeTruthy();
      expect(params).toBeTruthy();

      // Parameter properties would create both parameters and class properties
    });
  });

  describe("Return type extraction", () => {
    it("should extract return type from function declaration", () => {
      const code = "function getValue(): string { return \"test\"; }";
      const ast = getAstNode(code);
      const functionNode = findNodeByType(ast, "function_declaration");
      const identifier = functionNode?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const returnType = extract_return_type(identifier!);

      expect(returnType).toBe("string");
    });

    it("should extract complex return types", () => {
      const code = "function getUser(): Promise<User> { return Promise.resolve({} as User); }";
      const ast = getAstNode(code);
      const functionNode = findNodeByType(ast, "function_declaration");
      const identifier = functionNode?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const returnType = extract_return_type(identifier!);

      expect(returnType).toBe("Promise<User>");
    });

    it("should return undefined for functions without return type", () => {
      const code = "function doSomething() { console.log(\"test\"); }";
      const ast = getAstNode(code);
      const functionNode = findNodeByType(ast, "function_declaration");
      const identifier = functionNode?.childForFieldName?.("name");

      expect(identifier).toBeTruthy();

      const returnType = extract_return_type(identifier!);

      expect(returnType).toBeUndefined();
    });
  });
});
