import { describe, it, expect } from "vitest";
import { CommonScopeBoundaryExtractor } from "./scopes.boundary_base";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

describe("CommonScopeBoundaryExtractor", () => {
  const extractor = new CommonScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

  // Helper to create mock nodes
  function create_mock_node(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    end_position = { row: 0, column: 10 }
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      endPosition: end_position,
      parent: null,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      childForFieldName: (name: string) => fields[name] || null,
      child: () => null,
      children: [],
      childCount: 0,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      has_changes: () => false,
      has_error: () => false,
      is_missing: () => false,
      is_named: () => true,
      to_string: () => type,
      walk: () => ({} as any),
      descendant_for_index: () => null as any,
      descendant_for_position: () => null as any,
      named_descendant_for_index: () => null as any,
      named_descendant_for_position: () => null as any,
    } as unknown as Parser.SyntaxNode;
  }

  describe("extract_boundaries", () => {
    it("should route class scope types to extract_class_boundaries", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("class_body");
      const class_node = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_node, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should route function scope types to extract_function_boundaries", () => {
      const name_node = create_mock_node("identifier");
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const function_node = create_mock_node("function_declaration", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(1);
    });

    it("should route method scope types to extract_function_boundaries", () => {
      const name_node = create_mock_node("identifier");
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const method_node = create_mock_node("method_definition", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(method_node, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should route constructor scope types to extract_constructor_boundaries", () => {
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const constructor_node = create_mock_node("constructor", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(constructor_node, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should route block scope types to extract_block_boundaries", () => {
      const block_node = create_mock_node("block", {}, { row: 2, column: 5 }, { row: 5, column: 1 });

      const result = extractor.extract_boundaries(block_node, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(3);
      expect(result.scope_location.start_column).toBe(6);
    });

    it("should throw error for unsupported scope types", () => {
      const node = create_mock_node("some_node");

      expect(() => {
        extractor.extract_boundaries(node, "unsupported" as any, file_path);
      }).toThrow("Unsupported scope type: unsupported");
    });
  });

  describe("extract_class_boundaries", () => {
    it("should extract symbol and scope locations for classes", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 13 });
      const body_node = create_mock_node("class_body", {}, { row: 0, column: 14 }, { row: 5, column: 1 });
      const class_node = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_node, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(7);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(15);
    });

    it("should throw error when class has no name field", () => {
      const body_node = create_mock_node("class_body");
      const class_node = create_mock_node("class_declaration", {
        body: body_node,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(class_node, "class", file_path);
      }).toThrow("class_declaration has no name field");
    });

    it("should throw error when class has no body field", () => {
      const name_node = create_mock_node("identifier");
      const class_node = create_mock_node("class_declaration", {
        name: name_node,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(class_node, "class", file_path);
      }).toThrow("class_declaration has no body field");
    });
  });

  describe("extract_function_boundaries", () => {
    it("should extract boundaries for named functions", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 15 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 15 }, { row: 0, column: 18 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 19 }, { row: 3, column: 1 });
      const function_node = create_mock_node("function_declaration", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(10);
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(16); // params start + 1
      expect(result.scope_location.end_line).toBe(4);
      expect(result.scope_location.end_column).toBe(1);
    });

    it("should extract boundaries for anonymous functions", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 11 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 12 }, { row: 2, column: 1 });
      const function_node = create_mock_node("function_expression", {
        parameters: params_node,
        body: body_node,
        // No name field
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.symbol_location.start_column).toBe(9); // params location
      expect(result.scope_location.start_line).toBe(1);
      expect(result.scope_location.start_column).toBe(9); // params start + 1
    });

    it("should throw error when function has no parameters field", () => {
      const body_node = create_mock_node("block");
      const function_node = create_mock_node("function_declaration", {
        body: body_node,
        // No parameters field
      });

      expect(() => {
        extractor.extract_boundaries(function_node, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });

    it("should throw error when function has no body field", () => {
      const params_node = create_mock_node("formal_parameters");
      const function_node = create_mock_node("function_declaration", {
        parameters: params_node,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(function_node, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("should delegate to extract_function_boundaries", () => {
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const constructor_node = create_mock_node("constructor", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(constructor_node, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_block_boundaries", () => {
    it("should use entire node for both symbol and scope", () => {
      const block_node = create_mock_node("block", {}, { row: 3, column: 4 }, { row: 8, column: 5 });

      const result = extractor.extract_boundaries(block_node, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(4);
      expect(result.scope_location.start_column).toBe(5);
      expect(result.scope_location.end_line).toBe(9);
      expect(result.scope_location.end_column).toBe(5);
    });
  });
});