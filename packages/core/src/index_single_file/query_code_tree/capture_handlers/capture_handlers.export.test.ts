/**
 * Comprehensive test to verify export detection across all definition types
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { JAVASCRIPT_HANDLERS } from "./capture_handlers.javascript";
import { TYPESCRIPT_HANDLERS } from "./capture_handlers.typescript";
import { DefinitionBuilder } from "../../definitions";
import type { ProcessingContext, CaptureNode } from "../../semantic_index";
import type { FilePath, SymbolName, ScopeId, LexicalScope } from "@ariadnejs/types";

const js_parser = new Parser();
js_parser.setLanguage(JavaScript);

const ts_parser = new Parser();
ts_parser.setLanguage(TypeScript.typescript);

const TEST_FILE_PATH: FilePath = "test.js" as FilePath;

function create_test_context(): ProcessingContext {
  return {
    get_scope_id: () => "test-scope" as ScopeId,
    get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => "test-scope" as ScopeId,
    captures: [],
    scopes: new Map<ScopeId, LexicalScope>(),
    scope_depths: new Map<ScopeId, number>(),
    root_scope_id: "test-scope" as ScopeId,
  };
}

function find_node_by_type(node: any, type: string): any {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const found = find_node_by_type(node.child(i), type);
    if (found) return found;
  }
  return null;
}

function create_capture(
  code: string,
  capture_name: string,
  node_type: string,
  parser: Parser = js_parser
): CaptureNode {
  const ast = parser.parse(code);
  const node = find_node_by_type(ast.rootNode, node_type);
  if (!node) {
    throw new Error(`Could not find node of type ${node_type} in code: ${code}`);
  }

  return {
    name: capture_name,
    category: "definition" as any,
    entity: node_type as any,
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
      const capture = create_capture(code, "definition.function", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = JAVASCRIPT_HANDLERS["definition.function"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());

      expect(functions).toHaveLength(1);
      expect(functions[0].is_exported).toBe(true);
    });

    it("should detect exported classes", () => {
      const code = "export class MyClass {}";
      const capture = create_capture(code, "definition.class", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = JAVASCRIPT_HANDLERS["definition.class"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());

      expect(classes).toHaveLength(1);
      expect(classes[0].is_exported).toBe(true);
    });

    it("should detect exported variables", () => {
      const code = "export const x = 1;";
      const capture = create_capture(code, "definition.variable", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = JAVASCRIPT_HANDLERS["definition.variable"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const variables = Array.from(result.variables.values());

      expect(variables).toHaveLength(1);
      expect(variables[0].is_exported).toBe(true);
    });

    it("should not mark non-exported definitions as exported", () => {
      const code = "function notExported() {}";
      const capture = create_capture(code, "definition.function", "identifier");
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = JAVASCRIPT_HANDLERS["definition.function"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());

      expect(functions).toHaveLength(1);
      expect(functions[0].is_exported).toBe(false);
      expect(functions[0].export).toBeUndefined();
    });
  });

  describe("TypeScript - TypeScript-Specific Definition Types", () => {
    it("should detect exported interfaces", () => {
      const code = "export interface MyInterface { }";
      const capture = create_capture(code, "definition.interface", "type_identifier", ts_parser);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = TYPESCRIPT_HANDLERS["definition.interface"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const interfaces = Array.from(result.interfaces.values());

      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].is_exported).toBe(true);
    });

    it("should detect exported type aliases", () => {
      const code = "export type MyType = string;";
      const capture = create_capture(code, "definition.type_alias", "type_identifier", ts_parser);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = TYPESCRIPT_HANDLERS["definition.type_alias"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const type_aliases = Array.from(result.types.values());

      expect(type_aliases).toHaveLength(1);
      expect(type_aliases[0].is_exported).toBe(true);
    });

    it("should detect exported enums", () => {
      const code = "export enum Color { Red, Green }";
      const capture = create_capture(code, "definition.enum", "identifier", ts_parser);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = TYPESCRIPT_HANDLERS["definition.enum"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const enums = Array.from(result.enums.values());

      expect(enums).toHaveLength(1);
      expect(enums[0].is_exported).toBe(true);
    });

    it("should detect exported namespaces", () => {
      const code = "export namespace MyNamespace { }";
      const capture = create_capture(code, "definition.namespace", "identifier", ts_parser);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = TYPESCRIPT_HANDLERS["definition.namespace"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const namespaces = Array.from(result.namespaces.values());

      expect(namespaces).toHaveLength(1);
      expect(namespaces[0].is_exported).toBe(true);
    });

    it("should detect exported TypeScript classes", () => {
      const code = "export class MyClass { }";
      const capture = create_capture(code, "definition.class", "type_identifier", ts_parser);
      const context = create_test_context();
      const builder = new DefinitionBuilder(context);

      const handler = TYPESCRIPT_HANDLERS["definition.class"];
      handler?.(capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());

      expect(classes).toHaveLength(1);
      expect(classes[0].is_exported).toBe(true);
    });
  });

  describe("Handler Registry", () => {
    it("should preserve is_exported field for all definition types", () => {
      const test_cases = [
        { code: "export function foo() {}", type: "definition.function", node_type: "identifier" },
        { code: "export class Bar {}", type: "definition.class", node_type: "identifier" },
        { code: "export const x = 1;", type: "definition.variable", node_type: "identifier" },
      ];

      for (const test_case of test_cases) {
        const capture = create_capture(test_case.code, test_case.type, test_case.node_type);
        const context = create_test_context();
        const builder = new DefinitionBuilder(context);

        const handler = JAVASCRIPT_HANDLERS[test_case.type];
        handler?.(capture, builder, context);

        const result = builder.build();
        const all_defs = [
          ...Array.from(result.functions.values()),
          ...Array.from(result.classes.values()),
          ...Array.from(result.variables.values()),
        ];

        expect(all_defs.length).toBeGreaterThan(0);
        for (const def of all_defs) {
          expect(def.is_exported).toBeDefined();
        }
      }
    });
  });
});
