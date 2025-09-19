/**
 * Tests for references module public API
 * Smoke tests to verify exports are available and functioning
 */

import { describe, it, expect } from "vitest";
import type { FilePath, ScopeId, LexicalScope, SymbolId, Location } from "@ariadnejs/types";
import type { NormalizedCapture } from "../capture_types";
import { SemanticCategory, SemanticEntity } from "../capture_types";

// Import the public API from the index
import { process_references } from "./index";
import type { ProcessedReferences } from "./index";

describe("References Module Public API", () => {
  const mockLocation: Location = {
    file_path: "test.ts" as FilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockRootScope: LexicalScope = {
    id: "root" as ScopeId,
    parent_id: null,
    name: null,
    type: "module",
    location: mockLocation,
    child_ids: [],
    symbols: new Map(),
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    ["root" as ScopeId, mockRootScope],
  ]);

  describe("Exported Functions", () => {
    it("should export process_references function", () => {
      expect(typeof process_references).toBe("function");
    });

    it("should call process_references without errors with minimal inputs", () => {
      const result = process_references(
        [], // empty ref_captures
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should return ProcessedReferences with expected structure", () => {
      const result = process_references(
        [],
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      // Verify the result has the expected ProcessedReferences interface structure
      expect(result).toHaveProperty("calls");
      expect(result).toHaveProperty("type_flows");
      expect(result).toHaveProperty("returns");
      expect(result).toHaveProperty("member_accesses");
      expect(result).toHaveProperty("type_annotations");

      expect(Array.isArray(result.calls)).toBe(true);
      expect(Array.isArray(result.type_flows)).toBe(true);
      expect(Array.isArray(result.returns)).toBe(true);
      expect(Array.isArray(result.member_accesses)).toBe(true);
      expect(Array.isArray(result.type_annotations)).toBe(true);
    });
  });

  describe("Exported Types", () => {
    it("should export ProcessedReferences type that can be used for type checking", () => {
      // This test verifies the type is exported and can be used
      const mockProcessedReferences: ProcessedReferences = {
        calls: [],
        type_flows: [],
        returns: [],
        member_accesses: [],
        type_annotations: [],
      };

      expect(mockProcessedReferences).toBeDefined();
      expect(Array.isArray(mockProcessedReferences.calls)).toBe(true);
      expect(Array.isArray(mockProcessedReferences.type_flows)).toBe(true);
      expect(Array.isArray(mockProcessedReferences.returns)).toBe(true);
      expect(Array.isArray(mockProcessedReferences.member_accesses)).toBe(true);
      expect(Array.isArray(mockProcessedReferences.type_annotations)).toBe(true);
    });

    it("should support readonly arrays in ProcessedReferences", () => {
      // Verify that the readonly constraint is working
      const result = process_references(
        [],
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      // TypeScript should enforce readonly - these should compile without errors
      const calls: readonly any[] = result.calls;
      const typeFlows: readonly any[] = result.type_flows;
      const returns: readonly any[] = result.returns;
      const memberAccesses: readonly any[] = result.member_accesses;
      const typeAnnotations: readonly any[] = result.type_annotations;

      expect(calls).toBeDefined();
      expect(typeFlows).toBeDefined();
      expect(returns).toBeDefined();
      expect(memberAccesses).toBeDefined();
      expect(typeAnnotations).toBeDefined();
    });
  });

  describe("Integration Smoke Test", () => {
    it("should process references with various capture types", () => {
      const createMockCapture = (
        category: SemanticCategory,
        entity: SemanticEntity,
        text: string
      ): NormalizedCapture => ({
        category,
        entity,
        node_location: mockLocation,
        text,
        modifiers: {},
      });

      const refCaptures = [
        createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.CALL, "func()"),
        createMockCapture(SemanticCategory.REFERENCE, SemanticEntity.MEMBER_ACCESS, "obj.prop"),
      ];

      const assignments = [
        createMockCapture(SemanticCategory.ASSIGNMENT, SemanticEntity.VARIABLE, "x = 5"),
      ];

      const typeCaptures = [
        createMockCapture(SemanticCategory.TYPE, SemanticEntity.TYPE_ANNOTATION, "string"),
      ];

      const returns = [
        createMockCapture(SemanticCategory.RETURN, SemanticEntity.VARIABLE, "return x"),
      ];

      const result = process_references(
        refCaptures,
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath,
        assignments,
        typeCaptures,
        returns
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      // The actual processing logic is tested in references.test.ts
      // This just verifies the public API works end-to-end
      expect(result.calls).toBeDefined();
      expect(result.type_flows).toBeDefined();
      expect(result.returns).toBeDefined();
      expect(result.member_accesses).toBeDefined();
      expect(result.type_annotations).toBeDefined();
    });
  });
});