import { describe, it, expect } from "vitest";
import { CommonScopeBoundaryExtractor } from "./scope_boundary_base";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

describe("CommonScopeBoundaryExtractor", () => {
  const extractor = new CommonScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

  // Helper to create mock nodes
  function createMockNode(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    endPosition = { row: 0, column: 10 }
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      endPosition: endPosition,
      parent: null,
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
    } as unknown as Parser.SyntaxNode;
  }

  describe("extract_boundaries", () => {
    it("should route class scope types to extract_class_boundaries", () => {
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

    it("should route function scope types to extract_function_boundaries", () => {
      const nameNode = createMockNode("identifier");
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const functionNode = createMockNode("function_declaration", {
        name: nameNode,
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(functionNode, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(1);
    });

    it("should route method scope types to extract_function_boundaries", () => {
      const nameNode = createMockNode("identifier");
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const methodNode = createMockNode("method_definition", {
        name: nameNode,
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(methodNode, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should route constructor scope types to extract_constructor_boundaries", () => {
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const constructorNode = createMockNode("constructor", {
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(constructorNode, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should route block scope types to extract_block_boundaries", () => {
      const blockNode = createMockNode("block", {}, { row: 2, column: 5 }, { row: 5, column: 1 });

      const result = extractor.extract_boundaries(blockNode, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(3);
      expect(result.scope_location.start_column).toBe(6);
    });

    it("should throw error for unsupported scope types", () => {
      const node = createMockNode("some_node");

      expect(() => {
        extractor.extract_boundaries(node, "unsupported" as any, file_path);
      }).toThrow("Unsupported scope type: unsupported");
    });
  });

  describe("extract_class_boundaries", () => {
    it("should extract symbol and scope locations for classes", () => {
      const nameNode = createMockNode("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 13 });
      const bodyNode = createMockNode("class_body", {}, { row: 0, column: 14 }, { row: 5, column: 1 });
      const classNode = createMockNode("class_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(classNode, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(7);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(15);
    });

    it("should throw error when class has no name field", () => {
      const bodyNode = createMockNode("class_body");
      const classNode = createMockNode("class_declaration", {
        body: bodyNode,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(classNode, "class", file_path);
      }).toThrow("class_declaration has no name field");
    });

    it("should throw error when class has no body field", () => {
      const nameNode = createMockNode("identifier");
      const classNode = createMockNode("class_declaration", {
        name: nameNode,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(classNode, "class", file_path);
      }).toThrow("class_declaration has no body field");
    });
  });

  describe("extract_function_boundaries", () => {
    it("should extract boundaries for named functions", () => {
      const nameNode = createMockNode("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 15 });
      const paramsNode = createMockNode("formal_parameters", {}, { row: 0, column: 15 }, { row: 0, column: 18 });
      const bodyNode = createMockNode("block", {}, { row: 0, column: 19 }, { row: 3, column: 1 });
      const functionNode = createMockNode("function_declaration", {
        name: nameNode,
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(functionNode, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(10);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(16); // params start + 1
      expect(result.scope_location.end_line).toBe(4);
      expect(result.scope_location.end_column).toBe(1);
    });

    it("should extract boundaries for anonymous functions", () => {
      const paramsNode = createMockNode("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 11 });
      const bodyNode = createMockNode("block", {}, { row: 0, column: 12 }, { row: 2, column: 1 });
      const functionNode = createMockNode("function_expression", {
        parameters: paramsNode,
        body: bodyNode,
        // No name field
      });

      const result = extractor.extract_boundaries(functionNode, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(9); // params location
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(9); // params start + 1
    });

    it("should throw error when function has no parameters field", () => {
      const bodyNode = createMockNode("block");
      const functionNode = createMockNode("function_declaration", {
        body: bodyNode,
        // No parameters field
      });

      expect(() => {
        extractor.extract_boundaries(functionNode, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });

    it("should throw error when function has no body field", () => {
      const paramsNode = createMockNode("formal_parameters");
      const functionNode = createMockNode("function_declaration", {
        parameters: paramsNode,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(functionNode, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("should delegate to extract_function_boundaries", () => {
      const paramsNode = createMockNode("formal_parameters");
      const bodyNode = createMockNode("block");
      const constructorNode = createMockNode("constructor", {
        parameters: paramsNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(constructorNode, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_block_boundaries", () => {
    it("should use entire node for both symbol and scope", () => {
      const blockNode = createMockNode("block", {}, { row: 3, column: 4 }, { row: 8, column: 5 });

      const result = extractor.extract_boundaries(blockNode, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(4);
      expect(result.scope_location.start_column).toBe(5);
      expect(result.scope_location.end_line).toBe(9);
      expect(result.scope_location.end_column).toBe(5);
    });
  });
});