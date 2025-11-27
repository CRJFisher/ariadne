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
  function create_mock_node(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    end_position = { row: 0, column: 10 },
    parent: Parser.SyntaxNode | null = null
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      end_position: end_position,
      parent,
      child_for_field_name: (name: string) => fields[name] || null,
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

  describe("extract_class_boundaries", () => {
    it("should handle class_body nodes directly", () => {
      const parent_class = create_mock_node("class_declaration", {
        name: create_mock_node("identifier"),
      });
      const class_body = create_mock_node("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_class);

      const result = extractor.extract_boundaries(class_body, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
      expect(result.scope_location.start_column).toBe(11);
    });

    it("should handle anonymous class bodies", () => {
      const parent_class = create_mock_node("class_expression", {}, { row: 0, column: 0 }, { row: 2, column: 1 });
      const class_body = create_mock_node("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_class);

      const result = extractor.extract_boundaries(class_body, "class", file_path);

      // For anonymous classes, symbol and scope should be the same
      expect(result.symbol_location).toEqual(result.scope_location);
    });

    it("should handle regular class declarations", () => {
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

    it("should handle mock nodes without name or body fields", () => {
      const mock_node = create_mock_node("class_declaration");

      const result = extractor.extract_boundaries(mock_node, "class", file_path);

      // Should fall back to using entire node for both symbol and scope
      expect(result.symbol_location).toEqual(result.scope_location);
    });
  });

  describe("extract_function_boundaries", () => {
    it("should handle arrow functions", () => {
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const arrow_function = create_mock_node("arrow_function", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(arrow_function, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle named function expressions", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("block", {}, { row: 2, column: 0 }, { row: 4, column: 1 });
      const function_keyword = create_mock_node("function", {}, { row: 0, column: 0 }, { row: 0, column: 8 });

      const named_function_expr = create_mock_node("function_expression", {
        name: name_node,
        body: body_node,
      });

      // Mock the child method to return the function keyword
      named_function_expr.child = (index: number) => index === 0 ? function_keyword : null;

      const result = extractor.extract_boundaries(named_function_expr, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      // Scope should start after function keyword
      expect(result.scope_location.start_column).toBe(9); // function keyword ends at 8, +1 = 9
    });

    it("should handle interface method signatures without bodies", () => {
      const name_node = create_mock_node("identifier");
      const params_node = create_mock_node("formal_parameters");
      const method_signature = create_mock_node("method_signature", {
        name: name_node,
        parameters: params_node,
        // No body field
      });

      const result = extractor.extract_boundaries(method_signature, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle functions without parameters or body (mock nodes)", () => {
      const mock_function = create_mock_node("function_declaration");

      const result = extractor.extract_boundaries(mock_function, "function", file_path);

      // Should fall back to using entire node
      expect(result.symbol_location).toEqual(result.scope_location);
    });

    it("should handle functions without parameters but with body", () => {
      const body_node = create_mock_node("block");
      const function_node = create_mock_node("function_declaration", {
        body: body_node,
        // No parameters
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle arrow functions with single parameter", () => {
      const param_node = create_mock_node("identifier");
      const body_node = create_mock_node("block");
      const arrow_function = create_mock_node("arrow_function", {
        parameter: param_node, // Single parameter field
        body: body_node,
      });

      const result = extractor.extract_boundaries(arrow_function, "function", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("should delegate to function boundary extraction", () => {
      const params_node = create_mock_node("formal_parameters");
      const body_node = create_mock_node("block");
      const constructor = create_mock_node("constructor", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(constructor, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("extract_block_boundaries", () => {
    it("should use entire node for block scopes", () => {
      const block_node = create_mock_node("block", {}, { row: 5, column: 2 }, { row: 10, column: 3 });

      const result = extractor.extract_boundaries(block_node, "block", file_path);

      expect(result.symbol_location).toEqual(result.scope_location);
      expect(result.scope_location.start_line).toBe(6); // row + 1
      expect(result.scope_location.start_column).toBe(3); // column + 1
      expect(result.scope_location.end_line).toBe(11);
      expect(result.scope_location.end_column).toBe(3);
    });
  });

  describe("extract_arrow_function_boundaries", () => {
    it("should handle arrow functions with parameters", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 1, column: 5 }, { row: 1, column: 15 });
      const body_node = create_mock_node("block", {}, { row: 1, column: 20 }, { row: 3, column: 1 });
      const arrow_function = create_mock_node("arrow_function", {
        parameters: params_node,
        body: body_node,
      });

      const result = (extractor as any).extract_arrow_function_boundaries(arrow_function, file_path);

      expect(result.symbol_location.start_line).toBe(2); // row + 1
      expect(result.symbol_location.start_column).toBe(6); // column + 1
      expect(result.scope_location.start_line).toBe(2);
      expect(result.scope_location.start_column).toBe(6);
      expect(result.scope_location.end_line).toBe(4);
      expect(result.scope_location.end_column).toBe(1);
    });

    it("should handle arrow functions without parameters", () => {
      const body_node = create_mock_node("block", {}, { row: 1, column: 10 }, { row: 2, column: 1 });
      const arrow_function = create_mock_node("arrow_function", {
        body: body_node,
        // No parameters
      });

      const result = (extractor as any).extract_arrow_function_boundaries(arrow_function, file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should throw error for arrow function without body", () => {
      const arrow_function = create_mock_node("arrow_function", {
        // No body
      });

      expect(() => {
        (extractor as any).extract_arrow_function_boundaries(arrow_function, file_path);
      }).toThrow("Arrow function missing body");
    });
  });

  describe("extract_class_body_boundaries", () => {
    it("should throw error for class_body without proper parent", () => {
      const class_body = create_mock_node("class_body");

      expect(() => {
        (extractor as any).extract_class_body_boundaries(class_body, file_path);
      }).toThrow("class_body node must have class declaration parent");
    });

    it("should handle class_body with class_expression parent", () => {
      const name_node = create_mock_node("identifier");
      const parent_class = create_mock_node("class_expression", {
        name: name_node,
      });
      const class_body = create_mock_node("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_class);

      const result = (extractor as any).extract_class_body_boundaries(class_body, file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });
  });
});