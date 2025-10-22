import { describe, it, expect } from "vitest";
import type Parser from "tree-sitter";
import type { FilePath, Language } from "@ariadnejs/types";
import {
  node_to_location,
  position_to_location,
  get_scope_boundary_extractor,
  CommonScopeBoundaryExtractor,
} from "./scope_boundary_extractor";

describe("scope_boundary_extractor infrastructure", () => {
  describe("position_to_location", () => {
    it("should convert tree-sitter positions to location correctly", () => {
      const start = { row: 0, column: 5 } as Parser.Point;
      const end = { row: 2, column: 10 } as Parser.Point;

      const location = position_to_location(start, end, "test.py" as FilePath);

      expect(location).toEqual({
        file_path: "test.py",
        start_line: 1,      // 0-indexed → 1-indexed
        start_column: 6,    // 0-indexed → 1-indexed
        end_line: 3,
        end_column: 10,
      });
    });
  });

  describe("node_to_location", () => {
    it("should convert tree-sitter node to location correctly", () => {
      const mock_node = {
        startPosition: { row: 0, column: 5 },
        endPosition: { row: 2, column: 10 },
      } as Parser.SyntaxNode;

      const location = node_to_location(mock_node, "test.py" as FilePath);

      expect(location).toEqual({
        file_path: "test.py",
        start_line: 1,      // 0-indexed → 1-indexed
        start_column: 6,    // 0-indexed → 1-indexed
        end_line: 3,
        end_column: 10,
      });
    });
  });

  describe("get_scope_boundary_extractor", () => {
    it("should return PythonScopeBoundaryExtractor for python", () => {
      const extractor = get_scope_boundary_extractor("python" as Language);
      expect(extractor).toBeDefined();
      expect(extractor.constructor.name).toBe("PythonScopeBoundaryExtractor");
    });

    it("should return TypeScriptScopeBoundaryExtractor for typescript", () => {
      const extractor = get_scope_boundary_extractor("typescript" as Language);
      expect(extractor).toBeDefined();
      expect(extractor.constructor.name).toBe("TypeScriptScopeBoundaryExtractor");
    });

    it("should return JavaScriptScopeBoundaryExtractor for javascript", () => {
      const extractor = get_scope_boundary_extractor("javascript" as Language);
      expect(extractor).toBeDefined();
      expect(extractor.constructor.name).toBe("JavaScriptScopeBoundaryExtractor");
    });

    it("should return Rust extractor for rust language", () => {
      const extractor = get_scope_boundary_extractor("rust" as Language);
      expect(extractor).toBeDefined();
      expect(extractor.constructor.name).toBe("RustScopeBoundaryExtractor");
    });

    it("should throw error for unknown language", () => {
      expect(() => {
        get_scope_boundary_extractor("unknown" as Language);
      }).toThrow(/No scope boundary extractor for language: unknown/);
    });
  });

  describe("CommonScopeBoundaryExtractor", () => {
    const extractor = new CommonScopeBoundaryExtractor();

    it("should create instance", () => {
      expect(extractor).toBeDefined();
      expect(extractor.extract_boundaries).toBeDefined();
    });

    it("should throw error for unsupported scope type", () => {
      const mock_node = {} as Parser.SyntaxNode;
      expect(() => {
        extractor.extract_boundaries(mock_node, "module", "test.py" as FilePath);
      }).toThrow(/Unsupported scope type: module/);
    });

    describe("extract_class_boundaries", () => {
      it("should extract class boundaries with name and body fields", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {
                startPosition: { row: 0, column: 6 },
                endPosition: { row: 0, column: 13 },
              } as Parser.SyntaxNode;
            }
            if (field === "body") {
              return {
                startPosition: { row: 0, column: 16 },
                endPosition: { row: 5, column: 1 },
              } as Parser.SyntaxNode;
            }
            return null;
          },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "class", "test.ts" as FilePath);

        expect(result.symbol_location).toEqual({
          file_path: "test.ts",
          start_line: 1,
          start_column: 7,
          end_line: 1,
          end_column: 13,
        });
        expect(result.scope_location).toEqual({
          file_path: "test.ts",
          start_line: 1,
          start_column: 17,
          end_line: 6,
          end_column: 1,
        });
      });

      it("should throw error when class has no name field", () => {
        const mock_node = {
          childForFieldName: () => null,
          type: "class_declaration",
        } as unknown as Parser.SyntaxNode;

        expect(() => {
          extractor.extract_boundaries(mock_node, "class", "test.ts" as FilePath);
        }).toThrow(/class_declaration has no name field/);
      });

      it("should throw error when class has no body field", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {} as Parser.SyntaxNode;
            }
            return null;
          },
          type: "class_declaration",
        } as Parser.SyntaxNode;

        expect(() => {
          extractor.extract_boundaries(mock_node, "class", "test.ts" as FilePath);
        }).toThrow(/class_declaration has no body field/);
      });
    });

    describe("extract_function_boundaries", () => {
      it("should extract function boundaries with name, parameters, and body", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {
                startPosition: { row: 1, column: 9 },
                endPosition: { row: 1, column: 16 },
              } as Parser.SyntaxNode;
            }
            if (field === "parameters") {
              return {
                startPosition: { row: 1, column: 16 },
                endPosition: { row: 1, column: 18 },
              } as Parser.SyntaxNode;
            }
            if (field === "body") {
              return {
                startPosition: { row: 1, column: 19 },
                endPosition: { row: 3, column: 1 },
              } as Parser.SyntaxNode;
            }
            return null;
          },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "function", "test.ts" as FilePath);

        expect(result.symbol_location).toEqual({
          file_path: "test.ts",
          start_line: 2,
          start_column: 10,
          end_line: 2,
          end_column: 16,
        });
        expect(result.scope_location).toEqual({
          file_path: "test.ts",
          start_line: 2,
          start_column: 17,
          end_line: 4,
          end_column: 1,
        });
      });

      it("should handle function without name (anonymous function)", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return null;
            }
            if (field === "parameters") {
              return {
                startPosition: { row: 1, column: 8 },
                endPosition: { row: 1, column: 10 },
              } as Parser.SyntaxNode;
            }
            if (field === "body") {
              return {
                startPosition: { row: 1, column: 11 },
                endPosition: { row: 3, column: 1 },
              } as Parser.SyntaxNode;
            }
            return null;
          },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "function", "test.ts" as FilePath);

        expect(result.symbol_location).toEqual({
          file_path: "test.ts",
          start_line: 2,
          start_column: 9,
          end_line: 2,
          end_column: 10,
        });
      });

      it("should throw error when function has no parameters field", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {} as Parser.SyntaxNode;
            }
            return null;
          },
          type: "function_declaration",
        } as Parser.SyntaxNode;

        expect(() => {
          extractor.extract_boundaries(mock_node, "function", "test.ts" as FilePath);
        }).toThrow(/function_declaration missing parameters or body/);
      });
    });

    describe("extract_constructor_boundaries", () => {
      it("should use same logic as function boundaries", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {
                startPosition: { row: 2, column: 2 },
                endPosition: { row: 2, column: 13 },
              } as Parser.SyntaxNode;
            }
            if (field === "parameters") {
              return {
                startPosition: { row: 2, column: 13 },
                endPosition: { row: 2, column: 15 },
              } as Parser.SyntaxNode;
            }
            if (field === "body") {
              return {
                startPosition: { row: 2, column: 16 },
                endPosition: { row: 4, column: 3 },
              } as Parser.SyntaxNode;
            }
            return null;
          },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "constructor", "test.ts" as FilePath);

        expect(result.symbol_location).toEqual({
          file_path: "test.ts",
          start_line: 3,
          start_column: 3,
          end_line: 3,
          end_column: 13,
        });
        expect(result.scope_location).toEqual({
          file_path: "test.ts",
          start_line: 3,
          start_column: 14,
          end_line: 5,
          end_column: 3,
        });
      });
    });

    describe("extract_block_boundaries", () => {
      it("should use entire node as both symbol and scope location", () => {
        const mock_node = {
          startPosition: { row: 3, column: 4 },
          endPosition: { row: 6, column: 5 },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "block", "test.ts" as FilePath);

        const expected_location = {
          file_path: "test.ts",
          start_line: 4,
          start_column: 5,
          end_line: 7,
          end_column: 5,
        };

        expect(result.symbol_location).toEqual(expected_location);
        expect(result.scope_location).toEqual(expected_location);
      });
    });

    describe("method boundaries", () => {
      it("should handle method scope type using function logic", () => {
        const mock_node = {
          childForFieldName: (field: string) => {
            if (field === "name") {
              return {
                startPosition: { row: 4, column: 2 },
                endPosition: { row: 4, column: 8 },
              } as Parser.SyntaxNode;
            }
            if (field === "parameters") {
              return {
                startPosition: { row: 4, column: 8 },
                endPosition: { row: 4, column: 10 },
              } as Parser.SyntaxNode;
            }
            if (field === "body") {
              return {
                startPosition: { row: 4, column: 11 },
                endPosition: { row: 6, column: 3 },
              } as Parser.SyntaxNode;
            }
            return null;
          },
        } as Parser.SyntaxNode;

        const result = extractor.extract_boundaries(mock_node, "method", "test.ts" as FilePath);

        expect(result.symbol_location).toEqual({
          file_path: "test.ts",
          start_line: 5,
          start_column: 3,
          end_line: 5,
          end_column: 8,
        });
      });
    });
  });
});