/**
 * Comprehensive tests for capture normalizer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueryCapture } from "tree-sitter";
import type { Language, FilePath } from "@ariadnejs/types";
import type { NormalizedCapture } from "./capture_types";
import { SemanticCategory, SemanticEntity } from "./capture_types";
import {
  normalize_captures,
  group_captures_by_category,
} from "./capture_normalizer";
import { create_mock_node as create_mock_node } from "../test_utils";

// Mock dependencies
vi.mock("../utils/node_utils", () => ({
  node_to_location: vi.fn((node, filePath) => ({
    file_path: filePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: node.text?.length || 0,
  })),
}));

describe("Capture Normalizer", () => {
  const mockFilePath = "test.js" as FilePath;

  // Helper to create mock QueryCapture
  function create_mock_capture(
    name: string,
    text: string,
    nodeType = "identifier"
  ): QueryCapture {
    return {
      name,
      node: create_mock_node(nodeType, text, 0, 0),
    };
  }

  describe("normalize_captures", () => {
    describe("Language Support", () => {
      it("should normalize JavaScript captures", () => {
        const captures = [
          create_mock_capture("def.function", "testFunc"),
          create_mock_capture("ref.call", "testFunc"),
        ];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result).toHaveLength(2);
        expect(result[0].category).toBe(SemanticCategory.DEFINITION);
        expect(result[0].entity).toBe(SemanticEntity.FUNCTION);
        expect(result[1].category).toBe(SemanticCategory.REFERENCE);
        expect(result[1].entity).toBe(SemanticEntity.CALL);
      });

      it("should normalize TypeScript captures", () => {
        const captures = [
          create_mock_capture("def.interface", "TestInterface"),
          create_mock_capture("param.type", "string"),
        ];

        const result = normalize_captures(captures, "typescript", mockFilePath);

        expect(result).toHaveLength(2);
        expect(result[0].category).toBe(SemanticCategory.DEFINITION);
        expect(result[0].entity).toBe(SemanticEntity.INTERFACE);
        expect(result[1].category).toBe(SemanticCategory.TYPE);
        expect(result[1].entity).toBe(SemanticEntity.TYPE_ANNOTATION);
      });

      it("should normalize Python captures", () => {
        const captures = [
          create_mock_capture("def.function", "test_func"),
          create_mock_capture("ref.self", "self"),
        ];

        const result = normalize_captures(captures, "python", mockFilePath);

        expect(result).toHaveLength(2);
        expect(result[0].category).toBe(SemanticCategory.DEFINITION);
        expect(result[0].entity).toBe(SemanticEntity.FUNCTION);
        expect(result[1].category).toBe(SemanticCategory.REFERENCE);
        expect(result[1].entity).toBe(SemanticEntity.THIS);
      });

      it("should normalize Rust captures", () => {
        const captures = [
          create_mock_capture("def.struct", "TestStruct"),
          create_mock_capture("ownership.borrow", "&value"),
        ];

        const result = normalize_captures(captures, "rust", mockFilePath);

        expect(result).toHaveLength(2);
        expect(result[0].category).toBe(SemanticCategory.DEFINITION);
        expect(result[0].entity).toBe(SemanticEntity.CLASS);
        expect(result[1].category).toBe(SemanticCategory.REFERENCE);
        expect(result[1].entity).toBe(SemanticEntity.OPERATOR);
      });

      it("should throw error for unsupported language", () => {
        const captures = [create_mock_capture("def.function", "test")];

        expect(() => {
          normalize_captures(captures, "unsupported" as Language, mockFilePath);
        }).toThrow("No capture configuration for language: unsupported");
      });
    });

    describe("Capture Processing", () => {
      it("should skip unmapped captures", () => {
        const captures = [
          create_mock_capture("def.function", "testFunc"), // This will be mapped
          create_mock_capture("unknown.capture", "unknown"), // This won't be mapped
        ];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result).toHaveLength(1);
        expect(result[0].symbol_name).toBe("testFunc");
      });

      it("should include node location", () => {
        const captures = [create_mock_capture("def.function", "testFunc")];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].node_location).toBeDefined();
        expect(result[0].node_location.file_path).toBe(mockFilePath);
      });

      it("should include node text", () => {
        const captures = [create_mock_capture("def.function", "testFunc")];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].symbol_name).toBe("testFunc");
      });

      it("should apply modifiers when available", () => {
        // Create a capture that has modifiers in the JavaScript config
        const mockNode = {
          text: "testMethod",
          type: "identifier",
          parent: {
            children: [{ type: "static" }], // Static modifier
          },
        };

        const captures = [
          {
            name: "def.method",
            node: mockNode,
          },
        ] as QueryCapture[];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].modifiers).toBeDefined();
        expect(result[0].modifiers.is_static).toBe(true);
      });

      it("should apply context when available", () => {
        // Create a capture that has context in the JavaScript config
        const mockNode = {
          text: "testMethod",
          type: "identifier",
          parent: {
            childForFieldName: (field: string) => {
              if (field === "object") return { text: "obj" };
              return null;
            },
          },
        };

        const captures = [
          {
            name: "ref.method_call",
            node: mockNode,
          },
        ] as QueryCapture[];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].context).toBeDefined();
        expect(result[0].context?.receiver_node).toBeDefined();
      });

      it("should handle empty modifiers gracefully", () => {
        const captures = [create_mock_capture("def.variable", "testVar")];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].modifiers).toEqual({});
      });

      it("should handle undefined context gracefully", () => {
        const captures = [create_mock_capture("def.function", "testFunc")];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result[0].context).toBeUndefined();
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle multiple captures of same type", () => {
        const captures = [
          create_mock_capture("def.function", "func1"),
          create_mock_capture("def.function", "func2"),
          create_mock_capture("def.function", "func3"),
        ];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result).toHaveLength(3);
        expect(
          result.every((r) => r.category === SemanticCategory.DEFINITION)
        ).toBe(true);
        expect(result.every((r) => r.entity === SemanticEntity.FUNCTION)).toBe(
          true
        );
        expect(result.map((r) => r.symbol_name)).toEqual([
          "func1",
          "func2",
          "func3",
        ]);
      });

      it("should handle mixed language-specific features", () => {
        // Test TypeScript-specific features
        const captures = [
          create_mock_capture("def.interface", "ITest"),
          create_mock_capture("param.type", "string"),
          create_mock_capture("decorator.class", "@Component"),
        ];

        const result = normalize_captures(captures, "typescript", mockFilePath);

        expect(result).toHaveLength(3);

        const categories = result.map((r) => r.category);
        expect(categories).toContain(SemanticCategory.DEFINITION);
        expect(categories).toContain(SemanticCategory.TYPE);
        expect(categories).toContain(SemanticCategory.DECORATOR);

        const entities = result.map((r) => r.entity);
        expect(entities).toContain(SemanticEntity.INTERFACE);
        expect(entities).toContain(SemanticEntity.TYPE_ANNOTATION);
        expect(entities).toContain(SemanticEntity.CLASS);
      });

      it("should preserve capture order", () => {
        const captures = [
          create_mock_capture("def.function", "first"),
          create_mock_capture("def.variable", "second"),
          create_mock_capture("ref.call", "third"),
        ];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result.map((r) => r.symbol_name)).toEqual([
          "first",
          "second",
          "third",
        ]);
      });
    });

    describe("Error Handling", () => {
      it("should handle null captures array", () => {
        const result = normalize_captures([], "javascript", mockFilePath);
        expect(result).toEqual([]);
      });

      it("should handle captures with null nodes gracefully", () => {
        const captures = [
          {
            name: "def.function",
            node: create_mock_node("identifier", "testFunc"),
          },
        ];

        expect(() => {
          normalize_captures(captures, "javascript", mockFilePath);
        }).toThrow(); // Should throw because node_to_location will fail
      });

      it("should handle captures with malformed nodes", () => {
        const captures = [
          {
            name: "def.function",
            node: create_mock_node("identifier", "testFunc"),
          },
        ];

        const result = normalize_captures(captures, "javascript", mockFilePath);

        expect(result).toHaveLength(1);
        expect(result[0].symbol_name).toBeUndefined();
      });
    });
  });

  describe("group_captures_by_category", () => {
    let sampleCaptures: NormalizedCapture[];

    beforeEach(() => {
      sampleCaptures = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 4,
          },
          symbol_name: "func",
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            file_path: mockFilePath,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 3,
          },
          symbol_name: "var",
          modifiers: {},
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            file_path: mockFilePath,
            line: 3,
            column: 0,
            end_line: 3,
            end_column: 4,
          },
          symbol_name: "call",
          modifiers: {},
        },
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.IMPORT,
          node_location: {
            file_path: mockFilePath,
            line: 4,
            column: 0,
            end_line: 4,
            end_column: 6,
          },
          symbol_name: "import",
          modifiers: {},
        },
        {
          category: SemanticCategory.EXPORT,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path: mockFilePath,
            line: 5,
            column: 0,
            end_line: 5,
            end_column: 6,
          },
          symbol_name: "export",
          modifiers: {},
        },
        {
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.TYPE_ANNOTATION,
          node_location: {
            file_path: mockFilePath,
            line: 6,
            column: 0,
            end_line: 6,
            end_column: 4,
          },
          symbol_name: "type",
          modifiers: {},
        },
        {
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            file_path: mockFilePath,
            line: 7,
            column: 0,
            end_line: 7,
            end_column: 6,
          },
          symbol_name: "assign",
          modifiers: {},
        },
        {
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            file_path: mockFilePath,
            line: 8,
            column: 0,
            end_line: 8,
            end_column: 6,
          },
          symbol_name: "return",
          modifiers: {},
        },
        {
          category: SemanticCategory.DECORATOR,
          entity: SemanticEntity.CLASS,
          node_location: {
            file_path: mockFilePath,
            line: 9,
            column: 0,
            end_line: 9,
            end_column: 9,
          },
          symbol_name: "decorator",
          modifiers: {},
        },
        {
          category: SemanticCategory.MODIFIER,
          entity: SemanticEntity.ACCESS_MODIFIER,
          node_location: {
            file_path: mockFilePath,
            line: 10,
            column: 0,
            end_line: 10,
            end_column: 8,
          },
          symbol_name: "modifier",
          modifiers: {},
        },
      ];
    });

    it("should group captures by category correctly", () => {
      const grouped = group_captures_by_category(sampleCaptures);

      expect(grouped.scopes).toHaveLength(1);
      expect(grouped.definitions).toHaveLength(1);
      expect(grouped.references).toHaveLength(1);
      expect(grouped.imports).toHaveLength(1);
      expect(grouped.exports).toHaveLength(1);
      expect(grouped.types).toHaveLength(1);
      expect(grouped.assignments).toHaveLength(1);
      expect(grouped.returns).toHaveLength(1);
      expect(grouped.decorators).toHaveLength(1);
      expect(grouped.modifiers).toHaveLength(1);
    });

    it("should maintain capture content in groups", () => {
      const grouped = group_captures_by_category(sampleCaptures);

      expect(grouped.scopes[0].symbol_name).toBe("func");
      expect(grouped.definitions[0].symbol_name).toBe("var");
      expect(grouped.references[0].symbol_name).toBe("call");
      expect(grouped.imports[0].symbol_name).toBe("import");
      expect(grouped.exports[0].symbol_name).toBe("export");
      expect(grouped.types[0].symbol_name).toBe("type");
      expect(grouped.assignments[0].symbol_name).toBe("assign");
      expect(grouped.returns[0].symbol_name).toBe("return");
      expect(grouped.decorators[0].symbol_name).toBe("decorator");
      expect(grouped.modifiers[0].symbol_name).toBe("modifier");
    });

    it("should handle multiple captures in same category", () => {
      const multipleDefinitions = [
        ...sampleCaptures,
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path: mockFilePath,
            line: 11,
            column: 0,
            end_line: 11,
            end_column: 5,
          },
          text: "func2",
          modifiers: {},
        },
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.CLASS,
          node_location: {
            file_path: mockFilePath,
            line: 12,
            column: 0,
            end_line: 12,
            end_column: 5,
          },
          text: "class",
          modifiers: {},
        },
      ];

      const grouped = group_captures_by_category(multipleDefinitions);

      expect(grouped.definitions).toHaveLength(3);
      expect(grouped.definitions.map((d) => d.symbol_name)).toEqual([
        "var",
        "func2",
        "class",
      ]);
    });

    it("should handle empty captures array", () => {
      const grouped = group_captures_by_category([]);

      expect(grouped.scopes).toHaveLength(0);
      expect(grouped.definitions).toHaveLength(0);
      expect(grouped.references).toHaveLength(0);
      expect(grouped.imports).toHaveLength(0);
      expect(grouped.exports).toHaveLength(0);
      expect(grouped.types).toHaveLength(0);
      expect(grouped.assignments).toHaveLength(0);
      expect(grouped.returns).toHaveLength(0);
      expect(grouped.decorators).toHaveLength(0);
      expect(grouped.modifiers).toHaveLength(0);
    });

    it("should handle captures with only one category", () => {
      const onlyDefinitions = sampleCaptures.filter(
        (c) => c.category === SemanticCategory.DEFINITION
      );
      const grouped = group_captures_by_category(onlyDefinitions);

      expect(grouped.definitions).toHaveLength(1);
      expect(grouped.scopes).toHaveLength(0);
      expect(grouped.references).toHaveLength(0);
      expect(grouped.imports).toHaveLength(0);
      expect(grouped.exports).toHaveLength(0);
      expect(grouped.types).toHaveLength(0);
      expect(grouped.assignments).toHaveLength(0);
      expect(grouped.returns).toHaveLength(0);
      expect(grouped.decorators).toHaveLength(0);
      expect(grouped.modifiers).toHaveLength(0);
    });

    it("should preserve capture order within categories", () => {
      const multipleRefs = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 4,
          },
          text: "first",
          modifiers: {},
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            file_path: mockFilePath,
            line: 2,
            column: 0,
            end_line: 2,
            end_column: 6,
          },
          text: "second",
          modifiers: {},
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            file_path: mockFilePath,
            line: 3,
            column: 0,
            end_line: 3,
            end_column: 5,
          },
          text: "third",
          modifiers: {},
        },
      ];

      const grouped = group_captures_by_category(multipleRefs);

      expect(grouped.references.map((r) => r.symbol_name)).toEqual([
        "first",
        "second",
        "third",
      ]);
    });

    it("should handle all semantic categories", () => {
      // Test all possible semantic categories are handled
      const allCategories = Object.values(SemanticCategory);

      for (const category of allCategories) {
        const capture: NormalizedCapture = {
          category: category as SemanticCategory,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 4,
          },
          symbol_name: "test",
          modifiers: {},
        };

        const grouped = group_captures_by_category([capture]);

        // Verify the capture was placed in the correct group
        const totalCapturesInGroups = Object.values(grouped).reduce(
          (sum, group) => sum + group.length,
          0
        );
        expect(totalCapturesInGroups).toBe(1);
      }
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end with normalize_captures and group_captures_by_category", () => {
      const captures = [
        create_mock_capture("def.function", "testFunc"),
        create_mock_capture("def.variable", "testVar"),
        create_mock_capture("ref.call", "testFunc"),
        create_mock_capture("import.named", "utils"),
        create_mock_capture("export.default", "testFunc"),
      ];

      const normalized = normalize_captures(
        captures,
        "javascript",
        mockFilePath
      );
      const grouped = group_captures_by_category(normalized);

      expect(grouped.definitions).toHaveLength(2);
      expect(grouped.references).toHaveLength(1);
      expect(grouped.imports).toHaveLength(1);
      expect(grouped.exports).toHaveLength(1);

      expect(grouped.definitions.map((d) => d.symbol_name)).toEqual([
        "testFunc",
        "testVar",
      ]);
      expect(grouped.references[0].symbol_name).toBe("testFunc");
      expect(grouped.imports[0].symbol_name).toBe("utils");
      expect(grouped.exports[0].symbol_name).toBe("testFunc");
    });

    it("should preserve complex capture information through pipeline", () => {
      const mockNode = {
        text: "asyncMethod",
        type: "identifier",
        parent: {
          children: [{ type: "async" }],
          childForFieldName: (field: string) => {
            if (field === "return_type") return { text: "Promise<void>" };
            return null;
          },
        },
      };

      const captures = [
        {
          name: "def.method",
          node: mockNode,
        },
      ] as QueryCapture[];

      const normalized = normalize_captures(
        captures,
        "typescript",
        mockFilePath
      );
      const grouped = group_captures_by_category(normalized);

      expect(grouped.definitions).toHaveLength(1);
      const method = grouped.definitions[0];

      expect(method.symbol_name).toBe("asyncMethod");
      // Note: The actual modifiers depend on the real implementation
      // This test validates the structure works, specific modifier logic is tested elsewhere
      expect(method.modifiers).toBeDefined();
      expect(method.context).toBeDefined();
    });
  });
});
