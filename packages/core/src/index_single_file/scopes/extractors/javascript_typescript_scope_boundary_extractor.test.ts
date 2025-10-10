import { describe, it, expect } from "vitest";
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

// Create a concrete test class since the base class is abstract
class TestJavaScriptTypeScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {}

describe("JavaScriptTypeScriptScopeBoundaryExtractor", () => {
  const extractor = new TestJavaScriptTypeScriptScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

  // Helper to create mock nodes
  function createMockNode(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    endPosition = { row: 0, column: 10 },
    parent: Parser.SyntaxNode | null = null
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      endPosition: endPosition,
      parent,
      childForFieldName: (name: string) => fields[name] || null,
      child: () => null,
      children: [],
      childCount: 0,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      hasChanges: () => false,
      hasError: () => false,
      isMissing: () => false,
      isNamed: () => true,
      toString: () => type,
      walk: () => ({} as any),
      descendantForIndex: () => null as any,
      descendantForPosition: () => null as any,
      namedDescendantForIndex: () => null as any,
      namedDescendantForPosition: () => null as any,
    } as Parser.SyntaxNode;
  }

  describe("extract_class_boundaries", () => {
    it("should handle class_body nodes directly", () => {
      const parentClass = createMockNode("class_declaration", {
        name: createMockNode("identifier"),
      });
      const classBody = createMockNode("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parentClass);

      const result = extractor.extract_boundaries(classBody, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
      expect(result.scope_location.start_column).toBe(11);
    });

    it("should handle anonymous class bodies", () => {
      const parentClass = createMockNode("class_expression", {}, { row: 0, column: 0 }, { row: 2, column: 1 });
      const classBody = createMockNode("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parentClass);

      const result = extractor.extract_boundaries(classBody, "class", file_path);

      // For anonymous classes, symbol and scope should be the same
      expect(result.symbol_location).toEqual(result.scope_location);
    });

    it("should handle regular class declarations", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("class_body");
      const classNode = createMockNode("class_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(classNode, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle mock nodes without name or body fields", () => {
      const mockNode = createMockNode("class_declaration");

      const result = extractor.extract_boundaries(mockNode, "class", file_path);

      // Should fall back to using entire node for both symbol and scope
      expect(result.symbol_location).toEqual(result.scope_location);
    });
  });

  describe("extract_function_boundaries", () => {
    it("should handle arrow functions", () => {
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const arrowFunction = createMockNode("arrow_function", {
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(arrowFunction, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle named function expressions", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("block", {}, { row: 2, column: 0 }, { row: 4, column: 1 });
      const functionKeyword = createMockNode("function", {}, { row: 0, column: 0 }, { row: 0, column: 8 });

      const namedFunctionExpr = createMockNode("function_expression", {
        name: nameNode,
        body: bodyNode,
      });

      // Mock the child method to return the function keyword
      namedFunctionExpr.child = (index: number) => index === 0 ? functionKeyword : null;

      const result = extractor.extract_boundaries(namedFunctionExpr, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      // Scope should start after function keyword
      expect(result.scope_location.start_column).toBe(9); // function keyword ends at 8, +1 = 9
    });

    it("should handle interface method signatures without bodies", () => {
      const nameNode = createMockNode("identifier");
      const paramsNode = createMockNode("formal_parameters");
      const methodSignature = createMockNode("method_signature", {
        name: nameNode,
        parameters: paramsNode,
        // No body field
      });

      const result = extractor.extract_boundaries(methodSignature, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle functions without parameters or body (mock nodes)", () => {
      const mockFunction = createMockNode("function_declaration");

      const result = extractor.extract_boundaries(mockFunction, "function", file_path);

      // Should fall back to using entire node
      expect(result.symbol_location).toEqual(result.scope_location);
    });

    it("should handle functions without parameters but with body", () => {
      const bodyNode = createMockNode("block");
      const functionNode = createMockNode("function_declaration", {
        body: bodyNode,
        // No parameters
      });

      const result = extractor.extract_boundaries(functionNode, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle arrow functions with single parameter", () => {
      const paramNode = createMockNode("identifier");
      const bodyNode = createMockNode("block");
      const arrowFunction = createMockNode("arrow_function", {
        parameter: paramNode, // Single parameter field
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(arrowFunction, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("should delegate to function boundary extraction", () => {
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const constructor = createMockNode("constructor", {
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(constructor, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_block_boundaries", () => {
    it("should use entire node for block scopes", () => {
      const blockNode = createMockNode("block", {}, { row: 5, column: 2 }, { row: 10, column: 3 });

      const result = extractor.extract_boundaries(blockNode, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(6); // row + 1
      expect(result.scope_location.start_column).toBe(3); // column + 1
      expect(result.scope_location.end_line).toBe(11);
      expect(result.scope_location.end_column).toBe(3);
    });
  });

  describe("extract_arrow_function_boundaries", () => {
    it("should handle arrow functions with parameters", () => {
      const paramsNode = createMockNode("formal_parameters", {}, { row: 1, column: 5 }, { row: 1, column: 15 });
      const bodyNode = createMockNode("block", {}, { row: 1, column: 20 }, { row: 3, column: 1 });
      const arrowFunction = createMockNode("arrow_function", {
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = (extractor as any).extract_arrow_function_boundaries(arrowFunction, file_path);

      expect(result.symbol_location.start_line).toBe(2); // row + 1
      expect(result.symbol_location.start_column).toBe(6); // column + 1
      expect(result.scope_location.start_line).toBe(2);
      expect(result.scope_location.start_column).toBe(6);
      expect(result.scope_location.end_line).toBe(4);
      expect(result.scope_location.end_column).toBe(1);
    });

    it("should handle arrow functions without parameters", () => {
      const bodyNode = createMockNode("block", {}, { row: 1, column: 10 }, { row: 2, column: 1 });
      const arrowFunction = createMockNode("arrow_function", {
        body: bodyNode,
        // No parameters
      });

      const result = (extractor as any).extract_arrow_function_boundaries(arrowFunction, file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should throw error for arrow function without body", () => {
      const arrowFunction = createMockNode("arrow_function", {
        // No body
      });

      expect(() => {
        (extractor as any).extract_arrow_function_boundaries(arrowFunction, file_path);
      }).toThrow("Arrow function missing body");
    });
  });

  describe("extract_class_body_boundaries", () => {
    it("should throw error for class_body without proper parent", () => {
      const classBody = createMockNode("class_body");

      expect(() => {
        (extractor as any).extract_class_body_boundaries(classBody, file_path);
      }).toThrow("class_body node must have class declaration parent");
    });

    it("should handle class_body with class_expression parent", () => {
      const nameNode = createMockNode("identifier");
      const parentClass = createMockNode("class_expression", {
        name: nameNode,
      });
      const classBody = createMockNode("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parentClass);

      const result = (extractor as any).extract_class_body_boundaries(classBody, file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });
  });
});