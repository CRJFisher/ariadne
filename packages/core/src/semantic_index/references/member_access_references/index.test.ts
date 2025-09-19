/**
 * Tests for member_access_references index.ts - Public API contract
 */

import { describe, it, expect } from "vitest";
import type { FilePath, SymbolName, ScopeId, LexicalScope } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";

// Test the public API exports from index.ts
import { process_member_access_references, MemberAccessReference } from "./index";

describe("Member Access References - Public API", () => {
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
    it("should export MemberAccessReference interface", () => {
      // Test that the interface is properly typed and accessible
      const memberAccess: MemberAccessReference = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 10,
        },
        member_name: "testProperty" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      expect(memberAccess.member_name).toBe("testProperty");
      expect(memberAccess.access_type).toBe("property");
      expect(memberAccess.is_optional_chain).toBe(false);
    });
  });

  describe("Exported Functions", () => {
    it("should export process_member_access_references function", () => {
      // Verify the function is exported and callable
      expect(typeof process_member_access_references).toBe("function");

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.MEMBER_ACCESS,
          text: "testProp",
          node_location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 1,
            end_column: 8,
          },
          modifiers: {},
          context: {},
        },
      ];

      const scopes = new Map([[mockScope.id, mockScope]]);

      // Should be callable and return expected type
      const result = process_member_access_references(
        captures,
        mockScope,
        scopes,
        mockFilePath
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("member_name");
      expect(result[0]).toHaveProperty("access_type");
      expect(result[0]).toHaveProperty("location");
      expect(result[0]).toHaveProperty("scope_id");
    });
  });

  describe("Public API Contract", () => {
    it("should export only intended public interface items", () => {
      // Verify the function is exported and functional
      expect(typeof process_member_access_references).toBe("function");

      // Verify function signature compatibility
      expect(process_member_access_references.length).toBe(4);
      expect(process_member_access_references.name).toBe("process_member_access_references");
    });

    it("should provide complete type definitions", () => {
      // Verify MemberAccessReference type is properly exported and usable
      const memberAccess: MemberAccessReference = {
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 5,
        },
        member_name: "testProp" as SymbolName,
        scope_id: mockScope.id,
        access_type: "property",
        object: {},
        is_optional_chain: false,
      };

      // All required properties should be accessible
      expect(memberAccess.location).toBeDefined();
      expect(memberAccess.member_name).toBeDefined();
      expect(memberAccess.scope_id).toBeDefined();
      expect(memberAccess.access_type).toBeDefined();
      expect(memberAccess.object).toBeDefined();
      expect(typeof memberAccess.is_optional_chain).toBe("boolean");
    });
  });

  describe("Re-export Integrity", () => {
    it("should provide functional re-exports", async () => {
      // Test that the re-exported function works as expected
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.PROPERTY,
          text: "testProperty",
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
      const result = process_member_access_references(
        captures,
        mockScope,
        scopes,
        mockFilePath
      );

      // Should work exactly as the main module implementation
      expect(result).toHaveLength(1);
      expect(result[0].member_name).toBe("testProperty");
      expect(result[0].access_type).toBe("property");
    });
  });
});