/**
 * Comprehensive test to verify export detection across all definition types
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder";
import { TYPESCRIPT_BUILDER_CONFIG } from "./typescript_builder_config";
import { DefinitionBuilder } from "../../definitions";
import type { ProcessingContext, CaptureNode } from "../../semantic_index";
import type { FilePath, SymbolName, ScopeId, Location } from "@ariadnejs/types";

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const tsParser = new Parser();
tsParser.setLanguage(TypeScript.typescript);

const TEST_FILE_PATH: FilePath = "test.js" as FilePath;

function createTestContext(): ProcessingContext {
  const scope_stack: ScopeId[] = [];
  return {
    get_scope_id: () => "test-scope" as ScopeId,
    push_scope: (scope_id: ScopeId) => scope_stack.push(scope_id),
    pop_scope: () => scope_stack.pop(),
    scope_stack,
  };
}

function findNodeByType(node: any, type: string): any {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = findNodeByType(node.child(i), type);
    if (found) return found;
  }
  return null;
}

function createCapture(
  code: string,
  captureName: string,
  nodeType: string,
  parser: Parser = jsParser
): CaptureNode {
  const ast = parser.parse(code);
  const node = findNodeByType(ast.rootNode, nodeType);
  if (!node) {
    throw new Error(`Could not find node of type ${nodeType} in code: ${code}`);
  }

  return {
    name: captureName,
    category: "definition" as any,
    entity: nodeType as any,
    node: node as any,
    text: node.text as SymbolName,
    location: {
      file_path: TEST_FILE_PATH,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column + 1,
    },
  };
}

describe("Export Detection - Comprehensive Verification", () => {
  describe("JavaScript - All Definition Types", () => {
    it("should detect exported functions", () => {
      const code = "export function foo() {}";
      const capture = createCapture(code, "definition.function", "identifier");
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
      config?.process(capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());

      expect(functions).toHaveLength(1);
      expect(functions[0].is_exported).toBe(true);
      expect(functions[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported classes", () => {
      const code = "export class MyClass {}";
      const capture = createCapture(code, "definition.class", "identifier");
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
      config?.process(capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());

      expect(classes).toHaveLength(1);
      expect(classes[0].is_exported).toBe(true);
      expect(classes[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported variables", () => {
      const code = "export const x = 1;";
      const capture = createCapture(code, "definition.variable", "identifier");
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.variable");
      config?.process(capture, builder, context);

      const result = builder.build();
      const variables = Array.from(result.variables.values());

      expect(variables).toHaveLength(1);
      expect(variables[0].is_exported).toBe(true);
      expect(variables[0].availability).toBeDefined(); // Backward compatibility
    });

    it.skip("should mark class methods as not exported", () => {
      const code = `class MyClass { myMethod() {} }`;
      const ast = jsParser.parse(code);
      const classNode = findNodeByType(ast.rootNode, "identifier");

      const classCapture = createCapture(code, "definition.class", "identifier");
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const classConfig = JAVASCRIPT_BUILDER_CONFIG.get("definition.class");
      classConfig?.process(classCapture, builder, context);

      // Find method identifier
      const methodNode = ast.rootNode.descendantsOfType("identifier")
        .find((n: any) => n.text === "myMethod");
      if (!methodNode) throw new Error("Method not found");

      const methodCapture: CaptureNode = {
        name: "definition.method",
        category: "definition" as any,
        entity: "identifier" as any,
        node: methodNode as any,
        text: "myMethod" as SymbolName,
        location: {
          file_path: TEST_FILE_PATH,
          start_line: methodNode.startPosition.row + 1,
          start_column: methodNode.startPosition.column + 1,
          end_line: methodNode.endPosition.row + 1,
          end_column: methodNode.endPosition.column + 1,
        },
      };

      const methodConfig = JAVASCRIPT_BUILDER_CONFIG.get("definition.method");
      methodConfig?.process(methodCapture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());

      expect(classes[0].methods).toBeDefined();
      const methods = Array.from(classes[0].methods!.values());
      expect(methods[0].base.is_exported).toBe(false); // Methods not directly exported
    });

    it("should not mark non-exported definitions as exported", () => {
      const code = "function notExported() {}";
      const capture = createCapture(code, "definition.function", "identifier");
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = JAVASCRIPT_BUILDER_CONFIG.get("definition.function");
      config?.process(capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());

      expect(functions).toHaveLength(1);
      expect(functions[0].is_exported).toBe(false);
      expect(functions[0].export).toBeUndefined();
      expect(functions[0].availability).toBeDefined(); // Backward compatibility
    });
  });

  describe("TypeScript - TypeScript-Specific Definition Types", () => {
    it("should detect exported interfaces", () => {
      const code = "export interface MyInterface { }";
      const capture = createCapture(code, "definition.interface", "type_identifier", tsParser);
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = TYPESCRIPT_BUILDER_CONFIG.get("definition.interface");
      config?.process(capture, builder, context);

      const result = builder.build();
      const interfaces = Array.from(result.interfaces.values());

      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].is_exported).toBe(true);
      expect(interfaces[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported type aliases", () => {
      const code = "export type MyType = string;";
      const capture = createCapture(code, "definition.type_alias", "type_identifier", tsParser);
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = TYPESCRIPT_BUILDER_CONFIG.get("definition.type_alias");
      config?.process(capture, builder, context);

      const result = builder.build();
      const typeAliases = Array.from(result.types.values());

      expect(typeAliases).toHaveLength(1);
      expect(typeAliases[0].is_exported).toBe(true);
      expect(typeAliases[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported enums", () => {
      const code = "export enum Color { Red, Green }";
      const capture = createCapture(code, "definition.enum", "identifier", tsParser);
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = TYPESCRIPT_BUILDER_CONFIG.get("definition.enum");
      config?.process(capture, builder, context);

      const result = builder.build();
      const enums = Array.from(result.enums.values());

      expect(enums).toHaveLength(1);
      expect(enums[0].is_exported).toBe(true);
      expect(enums[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported namespaces", () => {
      const code = "export namespace MyNamespace { }";
      const capture = createCapture(code, "definition.namespace", "identifier", tsParser);
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = TYPESCRIPT_BUILDER_CONFIG.get("definition.namespace");
      config?.process(capture, builder, context);

      const result = builder.build();
      const namespaces = Array.from(result.namespaces.values());

      expect(namespaces).toHaveLength(1);
      expect(namespaces[0].is_exported).toBe(true);
      expect(namespaces[0].availability).toBeDefined(); // Backward compatibility
    });

    it("should detect exported TypeScript classes", () => {
      const code = "export class MyClass { }";
      const capture = createCapture(code, "definition.class", "type_identifier", tsParser);
      const context = createTestContext();
      const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

      const config = TYPESCRIPT_BUILDER_CONFIG.get("definition.class");
      config?.process(capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());

      expect(classes).toHaveLength(1);
      expect(classes[0].is_exported).toBe(true);
      expect(classes[0].availability).toBeDefined(); // Backward compatibility
    });
  });

  describe("Backward Compatibility", () => {
    it("should preserve availability field for all definition types", () => {
      const testCases = [
        { code: "export function foo() {}", type: "definition.function", nodeType: "identifier" },
        { code: "export class Bar {}", type: "definition.class", nodeType: "identifier" },
        { code: "export const x = 1;", type: "definition.variable", nodeType: "identifier" },
      ];

      for (const testCase of testCases) {
        const capture = createCapture(testCase.code, testCase.type, testCase.nodeType);
        const context = createTestContext();
        const builder = new DefinitionBuilder(context, TEST_FILE_PATH);

        const config = JAVASCRIPT_BUILDER_CONFIG.get(testCase.type);
        config?.process(capture, builder, context);

        const result = builder.build();
        const allDefs = [
          ...Array.from(result.functions.values()),
          ...Array.from(result.classes.values()),
          ...Array.from(result.variables.values()),
        ];

        expect(allDefs.length).toBeGreaterThan(0);
        for (const def of allDefs) {
          expect(def.availability).toBeDefined();
          expect(def.is_exported).toBeDefined();
        }
      }
    });
  });
});
