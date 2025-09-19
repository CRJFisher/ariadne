/**
 * Tests for call_references module public API
 * Smoke tests to verify exports are available and functioning
 */

import { describe, it, expect } from "vitest";
import type { FilePath, ScopeId, LexicalScope, Location } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticCategory, SemanticEntity } from "../../capture_types";

// Import the public API from the index
import { process_call_references } from "./index";
import type { CallReference } from "./index";

describe("Call References Module Public API", () => {
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
    it("should export process_call_references function", () => {
      expect(typeof process_call_references).toBe("function");
    });

    it("should call process_call_references without errors with minimal inputs", () => {
      const result = process_call_references(
        [], // empty captures
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return array of CallReference objects", () => {
      const result = process_call_references(
        [],
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0); // Empty input should return empty array
    });
  });

  describe("Re-exports", () => {
    it("should re-export process_call_references from call_references module", async () => {
      const indexModule = await import("./index");
      const callReferencesModule = await import("./call_references");

      // Should be the same function reference
      expect(indexModule.process_call_references).toBe(callReferencesModule.process_call_references);
    });

    it("should only export expected items", async () => {
      const module = await import("./index");
      const exportedKeys = Object.keys(module);

      expect(exportedKeys).toEqual(["process_call_references"]);
    });
  });

  describe("Exported Types", () => {
    it("should export CallReference type that can be used for type checking", () => {
      // This test verifies the type is exported and can be used
      const mockCallReference: CallReference = {
        location: mockLocation,
        name: "testFunction",
        scope_id: "root" as ScopeId,
        call_type: "function",
      };

      expect(mockCallReference).toBeDefined();
      expect(mockCallReference.location).toBe(mockLocation);
      expect(mockCallReference.name).toBe("testFunction");
      expect(mockCallReference.scope_id).toBe("root");
      expect(mockCallReference.call_type).toBe("function");
    });

    it("should support all CallReference properties", () => {
      const fullCallReference: CallReference = {
        location: mockLocation,
        name: "methodCall",
        scope_id: "scope1" as ScopeId,
        call_type: "method",
        receiver: {
          type: { type_name: "MyClass" },
          location: mockLocation,
        },
        construct_target: mockLocation,
        containing_function: "parentFunc",
        super_class: "ParentClass",
        resolved_symbol: "resolvedSymbol",
        resolved_return_type: "stringType",
        is_static_call: false,
      };

      expect(fullCallReference).toBeDefined();
      expect(fullCallReference.call_type).toBe("method");
      expect(fullCallReference.receiver).toBeDefined();
      expect(fullCallReference.construct_target).toBe(mockLocation);
      expect(fullCallReference.containing_function).toBe("parentFunc");
      expect(fullCallReference.super_class).toBe("ParentClass");
      expect(fullCallReference.resolved_symbol).toBe("resolvedSymbol");
      expect(fullCallReference.resolved_return_type).toBe("stringType");
      expect(fullCallReference.is_static_call).toBe(false);
    });
  });

  describe("Integration Smoke Test", () => {
    it("should process call references with simple capture types", () => {
      const createMockCapture = (
        entity: SemanticEntity,
        text: string
      ): NormalizedCapture => ({
        category: SemanticCategory.REFERENCE,
        entity,
        node_location: mockLocation,
        text,
        modifiers: {},
        context: {},
      });

      const captures = [
        createMockCapture(SemanticEntity.CALL, "functionCall"),
        createMockCapture(SemanticEntity.SUPER, "super"),
      ];

      const result = process_call_references(
        captures,
        mockRootScope,
        mockScopes,
        "test.ts" as FilePath
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      // The actual processing logic is tested in call_references.test.ts
      // This just verifies the public API works end-to-end
      result.forEach((callRef) => {
        expect(callRef).toHaveProperty("location");
        expect(callRef).toHaveProperty("name");
        expect(callRef).toHaveProperty("scope_id");
        expect(callRef).toHaveProperty("call_type");
      });

      expect(result[0].call_type).toBe("function");
      expect(result[1].call_type).toBe("super");
    });
  });
});