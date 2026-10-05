import { describe, it, expect } from "vitest";
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";
import type { FilePath, Location } from "@ariadnejs/types";
import type Parser from "tree-sitter";

const extractor = new JavaScriptTypeScriptScopeBoundaryExtractor();
const file_path = "test.ts" as FilePath;

function create_mock_node(
  type: string,
  fields: Record<string, Parser.SyntaxNode | null> = {},
  position = { row: 0, column: 0 },
  end_position = { row: 0, column: 10 },
  parent: Parser.SyntaxNode | null = null,
): Parser.SyntaxNode {
  return {
    type,
    text: type,
    startPosition: position,
    endPosition: end_position,
    parent,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    childForFieldName: (name: string) => fields[name] || null,
    child: () => null,
    children: [],
    childCount: 0,
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
  } as Partial<Parser.SyntaxNode> as Parser.SyntaxNode;
}

describe("JavaScriptTypeScriptScopeBoundaryExtractor", () => {
  describe("extract_class_boundaries", () => {
    it("maps a class declaration name to the symbol and body to the scope", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 11 });
      const body_node = create_mock_node("class_body", {}, { row: 0, column: 12 }, { row: 5, column: 1 });
      const class_node = create_mock_node("class_declaration", { name: name_node, body: body_node });

      const result = extractor.extract_boundaries(class_node, "class", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 7, end_line: 1, end_column: 11 },
        scope_location: { file_path, start_line: 1, start_column: 13, end_line: 6, end_column: 1 },
      });
    });

    it("reads interface members from the object field when body is absent", () => {
      const name_node = create_mock_node("type_identifier", {}, { row: 0, column: 10 }, { row: 0, column: 15 });
      const object_node = create_mock_node("object_type", {}, { row: 0, column: 16 }, { row: 4, column: 1 });
      const interface_node = create_mock_node("interface_declaration", { name: name_node, object: object_node });

      const result = extractor.extract_boundaries(interface_node, "class", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 11, end_line: 1, end_column: 15 },
        scope_location: { file_path, start_line: 1, start_column: 17, end_line: 5, end_column: 1 },
      });
    });

    it("resolves a bare class_body against its parent class name and body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 9 });
      const parent_class = create_mock_node("class_declaration", { name: name_node });
      const class_body = create_mock_node("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_class);

      const result = extractor.extract_boundaries(class_body, "class", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 7, end_line: 1, end_column: 9 },
        scope_location: { file_path, start_line: 2, start_column: 11, end_line: 4, end_column: 1 },
      });
    });

    it("uses the class_body itself for both locations when the parent is anonymous", () => {
      const parent_class = create_mock_node("class_expression", {}, { row: 0, column: 0 }, { row: 2, column: 1 });
      const class_body = create_mock_node("class_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_class);

      const location: Location = { file_path, start_line: 2, start_column: 11, end_line: 4, end_column: 1 };
      const result = extractor.extract_boundaries(class_body, "class", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: location,
        scope_location: location,
      });
    });

    it("falls back to the whole node when neither name nor body is present", () => {
      const mock_node = create_mock_node("class_declaration", {}, { row: 0, column: 0 }, { row: 0, column: 10 });

      const location: Location = { file_path, start_line: 1, start_column: 1, end_line: 1, end_column: 10 };
      const result = extractor.extract_boundaries(mock_node, "class", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: location,
        scope_location: location,
      });
    });

    it("throws when a named class declaration has no body field", () => {
      const name_node = create_mock_node("identifier");
      const class_node = create_mock_node("class_declaration", { name: name_node });

      expect(() => extractor.extract_boundaries(class_node, "class", file_path)).toThrow(
        "class_declaration has no body field",
      );
    });

    it("throws when a bare class_body has no class declaration parent", () => {
      const class_body = create_mock_node("class_body");

      expect(() => extractor.extract_boundaries(class_body, "class", file_path)).toThrow(
        "class_body node must have class declaration parent",
      );
    });
  });

  describe("extract_function_boundaries", () => {
    it("scopes a function declaration from its parameters to the end of its body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 17 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 17 }, { row: 0, column: 19 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 20 }, { row: 2, column: 1 });
      const function_node = create_mock_node("function_declaration", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 17 },
        scope_location: { file_path, start_line: 1, start_column: 18, end_line: 3, end_column: 1 },
      });
    });

    it("scopes an anonymous function expression from its parameters", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 10 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 11 }, { row: 2, column: 1 });
      const function_node = create_mock_node("function_expression", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 9, end_line: 1, end_column: 10 },
        scope_location: { file_path, start_line: 1, start_column: 9, end_line: 3, end_column: 1 },
      });
    });

    it("opens a named function expression scope right after the function keyword", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 12 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 13 }, { row: 2, column: 1 });
      const function_keyword = create_mock_node("function", {}, { row: 0, column: 0 }, { row: 0, column: 8 });
      const function_node = create_mock_node("function_expression", { name: name_node, body: body_node });
      function_node.child = (index: number) => (index === 0 ? function_keyword : null);

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 12 },
        scope_location: { file_path, start_line: 1, start_column: 9, end_line: 3, end_column: 1 },
      });
    });

    it("scopes a body-less named function expression to its parameters", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 12 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 12 }, { row: 0, column: 20 });
      const function_keyword = create_mock_node("function", {}, { row: 0, column: 0 }, { row: 0, column: 8 });
      const function_node = create_mock_node("function_expression", { name: name_node, parameters: params_node });
      function_node.child = (index: number) => (index === 0 ? function_keyword : null);

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 12 },
        scope_location: { file_path, start_line: 1, start_column: 13, end_line: 1, end_column: 20 },
      });
    });

    it("collapses a body-less, parameter-less named function expression to just after the keyword", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 12 });
      const function_keyword = create_mock_node("function", {}, { row: 0, column: 0 }, { row: 0, column: 8 });
      const function_node = create_mock_node("function_expression", { name: name_node });
      function_node.child = (index: number) => (index === 0 ? function_keyword : null);

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 12 },
        scope_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 10 },
      });
    });

    it("scopes a body-less method signature to its parameters", () => {
      const name_node = create_mock_node("property_identifier", {}, { row: 0, column: 2 }, { row: 0, column: 8 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 10 });
      const method_signature = create_mock_node("method_signature", { name: name_node, parameters: params_node });

      const result = extractor.extract_boundaries(method_signature, "method", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 3, end_line: 1, end_column: 8 },
        scope_location: { file_path, start_line: 1, start_column: 9, end_line: 1, end_column: 10 },
      });
    });

    it("scopes a parameter-less function to its body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 12 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 14 }, { row: 2, column: 1 });
      const function_node = create_mock_node("function_declaration", { name: name_node, body: body_node });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 1, start_column: 10, end_line: 1, end_column: 12 },
        scope_location: { file_path, start_line: 1, start_column: 15, end_line: 3, end_column: 1 },
      });
    });

    it("falls back to the whole node when a function has neither parameters nor body", () => {
      const mock_function = create_mock_node("function_declaration", {}, { row: 0, column: 0 }, { row: 0, column: 10 });

      const location: Location = { file_path, start_line: 1, start_column: 1, end_line: 1, end_column: 10 };
      const result = extractor.extract_boundaries(mock_function, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: location,
        scope_location: location,
      });
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("scopes a constructor from its parameters like a function", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 1, column: 13 }, { row: 1, column: 15 });
      const body_node = create_mock_node("statement_block", {}, { row: 1, column: 16 }, { row: 3, column: 3 });
      const constructor = create_mock_node("constructor", { parameters: params_node, body: body_node });

      const result = extractor.extract_boundaries(constructor, "constructor", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 2, start_column: 14, end_line: 2, end_column: 15 },
        scope_location: { file_path, start_line: 2, start_column: 14, end_line: 4, end_column: 3 },
      });
    });
  });

  describe("extract_block_boundaries", () => {
    it("uses the entire node for both the symbol and the scope", () => {
      const block_node = create_mock_node("statement_block", {}, { row: 5, column: 2 }, { row: 10, column: 3 });

      const location: Location = { file_path, start_line: 6, start_column: 3, end_line: 11, end_column: 3 };
      const result = extractor.extract_boundaries(block_node, "block", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: location,
        scope_location: location,
      });
    });
  });

  describe("extract_arrow_function_boundaries", () => {
    it("scopes a parenthesized-parameter arrow from its parameters to the body end", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 1, column: 5 }, { row: 1, column: 15 });
      const body_node = create_mock_node("statement_block", {}, { row: 1, column: 20 }, { row: 3, column: 1 });
      const arrow_function = create_mock_node("arrow_function", { parameters: params_node, body: body_node });

      const result = extractor.extract_boundaries(arrow_function, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 2, start_column: 6, end_line: 2, end_column: 15 },
        scope_location: { file_path, start_line: 2, start_column: 6, end_line: 4, end_column: 1 },
      });
    });

    it("reads a single unparenthesized parameter from the parameter field", () => {
      const param_node = create_mock_node("identifier", {}, { row: 1, column: 5 }, { row: 1, column: 10 });
      const body_node = create_mock_node("statement_block", {}, { row: 1, column: 15 }, { row: 2, column: 1 });
      const arrow_function = create_mock_node("arrow_function", { parameter: param_node, body: body_node });

      const result = extractor.extract_boundaries(arrow_function, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 2, start_column: 6, end_line: 2, end_column: 10 },
        scope_location: { file_path, start_line: 2, start_column: 6, end_line: 3, end_column: 1 },
      });
    });

    it("falls back to the whole node when an arrow has no parameter list", () => {
      const body_node = create_mock_node("statement_block", {}, { row: 1, column: 10 }, { row: 2, column: 1 });
      const arrow_function = create_mock_node("arrow_function", { body: body_node }, { row: 1, column: 4 }, { row: 2, column: 1 });

      const result = extractor.extract_boundaries(arrow_function, "function", file_path);

      expect(result).toEqual<{ symbol_location: Location; scope_location: Location }>({
        symbol_location: { file_path, start_line: 2, start_column: 5, end_line: 3, end_column: 1 },
        scope_location: { file_path, start_line: 2, start_column: 5, end_line: 3, end_column: 1 },
      });
    });

    it("throws when an arrow function has no body", () => {
      const arrow_function = create_mock_node("arrow_function");

      expect(() => extractor.extract_boundaries(arrow_function, "function", file_path)).toThrow(
        "Arrow function missing body",
      );
    });
  });
});
