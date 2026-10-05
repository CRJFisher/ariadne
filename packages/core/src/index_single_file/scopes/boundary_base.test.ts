import { describe, it, expect } from "vitest";
import { CommonScopeBoundaryExtractor, type ScopeBoundaries } from "./boundary_base";
import type { FilePath, Location, SymbolName } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { SemanticCategory, SemanticEntity, type CaptureNode } from "../capture_types";

describe("CommonScopeBoundaryExtractor", () => {
  const extractor = new CommonScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

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
    } as Partial<Parser.SyntaxNode> as Parser.SyntaxNode;
  }

  function location(
    start_line: number,
    start_column: number,
    end_line: number,
    end_column: number
  ): Location {
    return { file_path, start_line, start_column, end_line, end_column };
  }

  describe("extract_boundaries dispatch", () => {
    it("routes class scope types to class extraction", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 13 });
      const body_node = create_mock_node("class_body", {}, { row: 0, column: 14 }, { row: 5, column: 1 });
      const class_node = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_node, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 7, 1, 13),
        scope_location: location(1, 15, 6, 1),
      };
      expect(result).toEqual(expected);
    });

    it("routes function scope types to function extraction", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 15 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 15 }, { row: 0, column: 18 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 19 }, { row: 3, column: 1 });
      const function_node = create_mock_node("function_declaration", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 10, 1, 15),
        scope_location: location(1, 16, 4, 1),
      };
      expect(result).toEqual(expected);
    });

    it("routes method scope types to function extraction", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 2 }, { row: 0, column: 8 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 10 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 11 }, { row: 2, column: 3 });
      const method_node = create_mock_node("method_definition", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(method_node, "method", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 3, 1, 8),
        scope_location: location(1, 9, 3, 3),
      };
      expect(result).toEqual(expected);
    });

    it("throws for unsupported scope types", () => {
      const node = create_mock_node("some_node");

      expect(() => {
        extractor.extract_boundaries(node, "unsupported" as never, file_path);
      }).toThrow("Unsupported scope type: unsupported");
    });
  });

  describe("extract_class_boundaries", () => {
    it("takes symbol from the name field and scope from the body field", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 6 }, { row: 0, column: 13 });
      const body_node = create_mock_node("class_body", {}, { row: 0, column: 14 }, { row: 5, column: 1 });
      const class_node = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_node, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 7, 1, 13),
        scope_location: location(1, 15, 6, 1),
      };
      expect(result).toEqual(expected);
    });

    it("throws when the class has no name field", () => {
      const body_node = create_mock_node("class_body");
      const class_node = create_mock_node("class_declaration", { body: body_node });

      expect(() => {
        extractor.extract_boundaries(class_node, "class", file_path);
      }).toThrow("class_declaration has no name field");
    });

    it("throws when the class has no body field", () => {
      const name_node = create_mock_node("identifier");
      const class_node = create_mock_node("class_declaration", { name: name_node });

      expect(() => {
        extractor.extract_boundaries(class_node, "class", file_path);
      }).toThrow("class_declaration has no body field");
    });
  });

  describe("extract_function_boundaries", () => {
    it("scopes a named function from its parameters to the end of its body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 9 }, { row: 0, column: 15 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 15 }, { row: 0, column: 18 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 19 }, { row: 3, column: 1 });
      const function_node = create_mock_node("function_declaration", {
        name: name_node,
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 10, 1, 15),
        scope_location: location(1, 16, 4, 1),
      };
      expect(result).toEqual(expected);
    });

    it("uses the parameters as the symbol location when there is no name", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 11 });
      const body_node = create_mock_node("block", {}, { row: 0, column: 12 }, { row: 2, column: 1 });
      const function_node = create_mock_node("function_expression", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(function_node, "function", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 9, 1, 11),
        scope_location: location(1, 9, 3, 1),
      };
      expect(result).toEqual(expected);
    });

    it("throws when the function has no parameters field", () => {
      const body_node = create_mock_node("block");
      const function_node = create_mock_node("function_declaration", { body: body_node });

      expect(() => {
        extractor.extract_boundaries(function_node, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });

    it("throws when the function has no body field", () => {
      const params_node = create_mock_node("formal_parameters");
      const function_node = create_mock_node("function_declaration", { parameters: params_node });

      expect(() => {
        extractor.extract_boundaries(function_node, "function", file_path);
      }).toThrow("function_declaration missing parameters or body");
    });
  });

  describe("extract_constructor_boundaries", () => {
    it("extracts the same boundaries as a function", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 1, column: 13 }, { row: 1, column: 15 });
      const body_node = create_mock_node("statement_block", {}, { row: 1, column: 16 }, { row: 4, column: 3 });
      const constructor_node = create_mock_node("method_definition", {
        parameters: params_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(constructor_node, "constructor", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(2, 14, 2, 15),
        scope_location: location(2, 14, 5, 3),
      };
      expect(result).toEqual(expected);
    });
  });

  describe("extract_block_boundaries", () => {
    it("uses the entire node for both symbol and scope", () => {
      const block_node = create_mock_node("block", {}, { row: 3, column: 4 }, { row: 8, column: 5 });

      const result = extractor.extract_boundaries(block_node, "block", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(4, 5, 9, 5),
        scope_location: location(4, 5, 9, 5),
      };
      expect(result).toEqual(expected);
    });
  });

  describe("extract_module_boundaries", () => {
    it("takes symbol from the name field and scope from the body field", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 7 }, { row: 0, column: 13 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 14 }, { row: 6, column: 1 });
      const module_node = create_mock_node("internal_module", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(module_node, "module", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 8, 1, 13),
        scope_location: location(1, 15, 7, 1),
      };
      expect(result).toEqual(expected);
    });

    it("falls back to the whole node for the scope when there is no body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 7 }, { row: 0, column: 13 });
      const module_node = create_mock_node("internal_module", { name: name_node }, { row: 0, column: 0 }, { row: 0, column: 20 });

      const result = extractor.extract_boundaries(module_node, "module", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 8, 1, 13),
        scope_location: location(1, 1, 1, 20),
      };
      expect(result).toEqual(expected);
    });

    it("falls back to the whole node for the symbol when there is no name", () => {
      const module_node = create_mock_node("program", {}, { row: 0, column: 0 }, { row: 9, column: 0 });

      const result = extractor.extract_boundaries(module_node, "module", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: location(1, 1, 10, 0),
        scope_location: location(1, 1, 10, 0),
      };
      expect(result).toEqual(expected);
    });
  });
});

describe("CommonScopeBoundaryExtractor.sort_captures", () => {
  const extractor = new CommonScopeBoundaryExtractor();

  function scope_capture(
    entity: SemanticEntity,
    start_line: number,
    start_column: number,
    end_line: number,
    end_column: number
  ): CaptureNode {
    return {
      category: SemanticCategory.SCOPE,
      entity,
      name: `scope.${entity}`,
      text: "" as SymbolName,
      location: {
        file_path: "test.ts" as FilePath,
        start_line,
        start_column,
        end_line,
        end_column,
      },
      node: {} as Parser.SyntaxNode,
    };
  }

  it("orders captures by location", () => {
    const later = scope_capture(SemanticEntity.FUNCTION, 10, 1, 12, 1);
    const earlier = scope_capture(SemanticEntity.FUNCTION, 1, 1, 3, 1);

    expect(extractor.sort_captures([later, earlier])).toEqual([
      earlier,
      later,
    ]);
  });

  it("breaks an identical-location tie by scope-type priority", () => {
    const block = scope_capture(SemanticEntity.BLOCK, 1, 1, 5, 1);
    const cls = scope_capture(SemanticEntity.CLASS, 1, 1, 5, 1);

    expect(extractor.sort_captures([block, cls])).toEqual([cls, block]);
  });
});
