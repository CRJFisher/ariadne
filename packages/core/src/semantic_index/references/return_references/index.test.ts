/**
 * Tests for return_references index.ts - Public API contract
 */

import { describe, it, expect, vi } from "vitest";
import type { FilePath, SymbolName, ScopeId, LexicalScope } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";

// Test the public API exports from index.ts
import { process_return_references, ReturnReference } from "./index";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

vi.mock("../type_tracking", () => ({
  build_typed_return_map: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";
import { build_typed_return_map } from "../type_tracking";

const mockFindContainingScope = vi.mocked(find_containing_scope);
const mockBuildTypedReturnMap = vi.mocked(build_typed_return_map);

describe("Return References - Public API", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockScope: LexicalScope = {
    id: "scope_1" as ScopeId,
    type: "function",
    location: {
      file_path: mockFilePath,
      line: 1,
      column: 0,
      end_line: 1,
      end_column: 10,
    },
    child_ids: [],
    symbols: new Map(),
    parent_id: null,
    name: "testFunction" as SymbolName,
  };

  describe("Exported Types", () => {
    it("should export ReturnReference interface", () => {
      // Test that the interface is properly typed and accessible
      const returnRef: ReturnReference = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10,
        },
        expression: "return value",
        scope_id: mockScope.id,
        function_scope_id: "func_scope" as ScopeId,
        is_conditional: false,
        is_async: false,
        is_yield: false,
      };

      expect(returnRef.expression).toBe("return value");
      expect(returnRef.scope_id).toBe(mockScope.id);
      expect(returnRef.is_conditional).toBe(false);
      expect(returnRef.is_async).toBe(false);
      expect(returnRef.is_yield).toBe(false);
    });

    it("should support optional fields in ReturnReference", () => {
      const returnRef: ReturnReference = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10,
        },
        expression: "return",
        scope_id: mockScope.id,
        function_scope_id: "func_scope" as ScopeId,
        function_symbol: "my_function" as any,
        returned_type: {
          type_name: "string" as SymbolName,
          certainty: "declared" as const,
          source: {
            kind: "annotation" as const,
            location: {
              file_path: mockFilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 10,
            },
          },
        },
        is_conditional: true,
        is_async: true,
        is_yield: true,
      };

      expect(returnRef.function_symbol).toBeDefined();
      expect(returnRef.returned_type).toBeDefined();
      expect(returnRef.is_conditional).toBe(true);
      expect(returnRef.is_async).toBe(true);
      expect(returnRef.is_yield).toBe(true);
    });
  });

  describe("Exported Functions", () => {
    it("should export process_return_references function", () => {
      // Verify the function is exported and callable
      expect(typeof process_return_references).toBe("function");

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.REFERENCE,
          text: "return value",
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 12,
          },
          modifiers: {},
          context: {},
        },
      ];

      const scopes = new Map([[mockScope.id, mockScope]]);

      // Mock the dependencies
      mockFindContainingScope.mockReturnValue(mockScope);
      mockBuildTypedReturnMap.mockReturnValue(new Map());

      // Should be callable and return expected type
      const result = process_return_references(
        captures,
        mockScope,
        scopes,
        mockFilePath
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0); // Empty since no return context mocked
    });

    it("should process return references with mocked context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.REFERENCE,
          text: "return 42",
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 9,
          },
          modifiers: {},
          context: {},
        },
      ];

      const scopes = new Map([[mockScope.id, mockScope]]);

      // Mock return context
      const returnContext = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 9,
        },
        function_scope_id: mockScope.id,
        returned_type: {
          type_name: "number" as SymbolName,
          certainty: "declared" as const,
          source: {
            kind: "annotation" as const,
            location: {
              file_path: mockFilePath,
              line: 1,
              column: 0,
              end_line: 1,
              end_column: 9,
            },
          },
        },
        is_conditional: false,
      };

      mockFindContainingScope.mockReturnValue(mockScope);
      mockBuildTypedReturnMap.mockReturnValue(
        new Map([[location_key(captures[0].node_location), returnContext]])
      );

      const result = process_return_references(
        captures,
        mockScope,
        scopes,
        mockFilePath
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("expression", "return 42");
      expect(result[0]).toHaveProperty("scope_id", mockScope.id);
      expect(result[0]).toHaveProperty("function_scope_id", mockScope.id);
      expect(result[0]).toHaveProperty("is_conditional", false);
      expect(result[0]).toHaveProperty("is_async", false);
      expect(result[0]).toHaveProperty("is_yield", false);
    });
  });

  describe("Public API Contract", () => {
    it("should export only intended public interface items", () => {
      // Verify only the expected exports are available
      expect(typeof process_return_references).toBe("function");

      // Type checking at compile time ensures ReturnReference is properly exported
      const testRef: ReturnReference = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10,
        },
        expression: "return test",
        scope_id: mockScope.id,
        function_scope_id: mockScope.id,
        is_conditional: false,
        is_async: false,
        is_yield: false,
      };

      expect(testRef).toBeDefined();
    });

    it("should maintain consistent function signature", () => {
      // Test that the function accepts the expected parameters
      const captures: NormalizedCapture[] = [];
      const scopes = new Map<ScopeId, LexicalScope>();

      mockBuildTypedReturnMap.mockReturnValue(new Map());

      expect(() => {
        process_return_references(captures, mockScope, scopes, mockFilePath);
      }).not.toThrow();

      // Test with optional scope_to_symbol parameter
      expect(() => {
        process_return_references(
          captures,
          mockScope,
          scopes,
          mockFilePath,
          new Map()
        );
      }).not.toThrow();
    });
  });

  describe("Integration with Module Dependencies", () => {
    it("should properly integrate with scope_tree module", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.REFERENCE,
          text: "return test",
          node_location: {
            file_path: mockFilePath,
            line: 2,
            column: 4,
            end_line: 2,
            end_column: 15,
          },
          modifiers: {},
          context: {},
        },
      ];

      mockFindContainingScope.mockReturnValue(mockScope);
      mockBuildTypedReturnMap.mockReturnValue(new Map());

      process_return_references(
        captures,
        mockScope,
        new Map([[mockScope.id, mockScope]]),
        mockFilePath
      );

      // Verify scope finding was called
      expect(mockFindContainingScope).toHaveBeenCalledWith(
        captures[0].node_location,
        mockScope,
        expect.any(Map)
      );
    });

    it("should properly integrate with type_tracking module", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.REFERENCE,
          text: "return value",
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 12,
          },
          modifiers: {},
          context: {},
        },
      ];

      mockFindContainingScope.mockReturnValue(mockScope);
      mockBuildTypedReturnMap.mockReturnValue(new Map());

      process_return_references(
        captures,
        mockScope,
        new Map([[mockScope.id, mockScope]]),
        mockFilePath
      );

      // Verify type tracking integration was called
      expect(mockBuildTypedReturnMap).toHaveBeenCalledWith(
        captures,
        mockScope,
        expect.any(Map)
      );
    });
  });
});