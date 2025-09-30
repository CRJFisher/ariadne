/**
 * Comprehensive tests for return references processing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  SymbolId,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../query_code_tree/capture_types";
import {
  SemanticEntity,
  SemanticCategory,
} from "../../query_code_tree/capture_types";
import {
  ReturnReference,
  process_return_references,
} from "./return_references";

// Mock dependencies
vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

import { find_containing_scope } from "../../scope_tree";

const mockFindContainingScope = vi.mocked(find_containing_scope);

describe("Return References", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "scope_1" as ScopeId,
    name: "testBlock" as SymbolName,
    type: "block",
    location: mockLocation,
    child_ids: [],
    parent_id: "func_scope" as ScopeId,
    symbols: new Map(),
  };

  const mockFunctionScope: LexicalScope = {
    id: "func_scope" as ScopeId,
    type: "function",
    location: {
      start_line: 1,
      start_column: 0,
      end_line: 15,
      end_column: 0,
      file_path: mockFilePath,
    },
    parent_id: "func_scope" as ScopeId,
    name: "testFunction" as SymbolName,
    symbols: new Map(),
    child_ids: [],
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    [mockScope.id, mockScope],
    [mockFunctionScope.id, mockFunctionScope],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
  });

  describe("ReturnReference Interface", () => {
    it("should define correct structure for simple returns", () => {
      const returnRef: ReturnReference = {
        location: mockLocation,
        expression: "return value",
        scope_id: mockScope.id,
        function_scope_id: mockFunctionScope.id,
        function_symbol: "func_symbol" as SymbolId,
      };

      expect(returnRef.location).toEqual(mockLocation);
      expect(returnRef.expression).toBe("return value");
      expect(returnRef.scope_id).toBe(mockScope.id);
      expect(returnRef.function_scope_id).toBe(mockFunctionScope.id);
    });

    it("should support optional fields", () => {
      const minimalReturn: ReturnReference = {
        location: mockLocation,
        expression: "return",
        scope_id: mockScope.id,
        function_scope_id: mockFunctionScope.id,
      };

      expect(minimalReturn.function_symbol).toBeUndefined();
    });
  });

  describe("process_return_references", () => {
    describe("Success Cases", () => {
      it("should process return captures with context", () => {
        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return 42",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].expression).toBe("return 42");
        expect(result[0].function_scope_id).toBe(mockFunctionScope.id);
      });

      it("should include function symbol when scope mapping provided", () => {
        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return value",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const scopeToSymbol = new Map<ScopeId, SymbolId>([
          [mockFunctionScope.id, "my_function" as SymbolId],
        ]);

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath,
          scopeToSymbol
        );

        expect(result).toHaveLength(1);
        expect(result[0].function_symbol).toBe("my_function");
      });

      it("should handle multiple return captures", () => {
        const location2: Location = {
          ...mockLocation,
          start_line: 5,
          start_column: 0,
          end_line: 5,
          end_column: 0,
        };

        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return first",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return second",
            node_location: location2,
            context: {},
            modifiers: {},
          },
        ];

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(2);
        expect(result[0].expression).toBe("return first");
        expect(result[1].expression).toBe("return second");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty returns array", () => {
        const result = process_return_references(
          [],
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should process returns without type context", () => {
        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return value",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].expression).toBe("return value");
      });

      it("should handle returns without function symbol mapping", () => {
        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return value",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].function_symbol).toBeUndefined();
      });

      it("should handle returns without type info", () => {
        const returns: NormalizedCapture[] = [
          {
            category: SemanticCategory.RETURN,
            entity: SemanticEntity.REFERENCE,
            text: "return",
            node_location: mockLocation,
            context: {},
            modifiers: {},
          },
        ];

        const result = process_return_references(
          returns,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
      });
    });
  });
});
