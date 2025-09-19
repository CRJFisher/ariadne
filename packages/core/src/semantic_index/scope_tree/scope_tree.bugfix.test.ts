/**
 * Bug fix tests for scope_tree module
 * These tests identify and verify fixes for bugs found in code review
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  FilePath,
  ScopeId,
  LexicalScope,
  Location,
} from "@ariadnejs/types";
import {
  module_scope,
  function_scope,
  class_scope,
} from "@ariadnejs/types";
import { build_scope_tree, compute_scope_depth, find_containing_scope } from "./scope_tree";
import { SemanticEntity } from "../capture_types";
import type { NormalizedCapture } from "../capture_types";

describe("Scope Tree Bug Fixes", () => {
  let file_path: FilePath;
  let base_location: Location;

  beforeEach(() => {
    file_path = "test.ts" as FilePath;
    base_location = {
      file_path,
      line: 1,
      column: 0,
      end_line: 1,
      end_column: 10,
    };
  });

  describe("compute_scope_depth bugs", () => {
    it("should not increment depth for non-existent parent scopes", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create a scope that references a non-existent parent
      const orphan_scope: LexicalScope = {
        id: "orphan" as ScopeId,
        parent_id: "nonexistent_parent" as ScopeId,
        name: null,
        type: "function",
        location: base_location,
        child_ids: [],
        symbols: new Map(),
      };

      const depth = compute_scope_depth(orphan_scope, scopes);

      // BUG: Current implementation incorrectly returns 1 instead of 0
      // The depth should be 0 since the parent doesn't actually exist
      expect(depth).toBe(0); // This will fail with current implementation
    });

    it("should handle chain of non-existent parents correctly", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Add one real scope
      const real_parent_id = function_scope(base_location);
      const real_parent: LexicalScope = {
        id: real_parent_id,
        parent_id: "nonexistent_grandparent" as ScopeId,
        name: null,
        type: "function",
        location: base_location,
        child_ids: [],
        symbols: new Map(),
      };
      scopes.set(real_parent_id, real_parent);

      // Create scope with real parent that has non-existent grandparent
      const child_scope: LexicalScope = {
        id: "child" as ScopeId,
        parent_id: real_parent_id,
        name: null,
        type: "function",
        location: { ...base_location, line: 2 },
        child_ids: [],
        symbols: new Map(),
      };

      const depth = compute_scope_depth(child_scope, scopes);

      // Should be depth 1 (child -> real_parent), not 2
      // BUG: Current implementation might return 2 due to non-existent grandparent
      expect(depth).toBe(1);
    });
  });

  describe("find_containing_scope performance and determinism", () => {
    it("should handle multiple scopes at same depth deterministically", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create root scope
      const root_location: Location = {
        file_path,
        line: 1,
        column: 0,
        end_line: 20,
        end_column: 100,
      };

      const root_id = module_scope(root_location);
      const root_scope: LexicalScope = {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: root_location,
        child_ids: [],
        symbols: new Map(),
      };
      scopes.set(root_id, root_scope);

      // Create two functions at same level with overlapping ranges
      const func1_location: Location = {
        file_path,
        line: 5,
        column: 0,
        end_line: 10,
        end_column: 50,
      };

      const func2_location: Location = {
        file_path,
        line: 5,
        column: 10,
        end_line: 15,
        end_column: 60,
      };

      const func1_id = function_scope(func1_location);
      const func1_scope: LexicalScope = {
        id: func1_id,
        parent_id: root_id,
        name: null,
        type: "function",
        location: func1_location,
        child_ids: [],
        symbols: new Map(),
      };

      const func2_id = function_scope(func2_location);
      const func2_scope: LexicalScope = {
        id: func2_id,
        parent_id: root_id,
        name: null,
        type: "function",
        location: func2_location,
        child_ids: [],
        symbols: new Map(),
      };

      scopes.set(func1_id, func1_scope);
      scopes.set(func2_id, func2_scope);

      // Location that overlaps both functions
      const test_location: Location = {
        file_path,
        line: 7,
        column: 15,
        end_line: 7,
        end_column: 20,
      };

      const result1 = find_containing_scope(test_location, root_scope, scopes);
      const result2 = find_containing_scope(test_location, root_scope, scopes);

      // Should return same result both times (deterministic)
      expect(result1.id).toBe(result2.id);

      // BUG: Current implementation might return different results due to Map iteration order
      // or might not handle overlapping scopes correctly
    });

    it("should prefer smaller/more specific scopes when multiple contain location", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create nested structure: root -> class -> method
      const root_location: Location = {
        file_path,
        line: 1,
        column: 0,
        end_line: 20,
        end_column: 100,
      };

      const class_location: Location = {
        file_path,
        line: 5,
        column: 0,
        end_line: 15,
        end_column: 50,
      };

      const method_location: Location = {
        file_path,
        line: 8,
        column: 4,
        end_line: 12,
        end_column: 20,
      };

      const root_id = module_scope(root_location);
      const class_id = class_scope(class_location);
      const method_id = function_scope(method_location);

      const root_scope: LexicalScope = {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: root_location,
        child_ids: [class_id],
        symbols: new Map(),
      };

      const class_scope_obj: LexicalScope = {
        id: class_id,
        parent_id: root_id,
        name: null,
        type: "class",
        location: class_location,
        child_ids: [method_id],
        symbols: new Map(),
      };

      const method_scope: LexicalScope = {
        id: method_id,
        parent_id: class_id,
        name: null,
        type: "method",
        location: method_location,
        child_ids: [],
        symbols: new Map(),
      };

      scopes.set(root_id, root_scope);
      scopes.set(class_id, class_scope_obj);
      scopes.set(method_id, method_scope);

      // Location inside the method
      const test_location: Location = {
        file_path,
        line: 10,
        column: 8,
        end_line: 10,
        end_column: 15,
      };

      const containing_scope = find_containing_scope(test_location, root_scope, scopes);

      // Should return the method scope (deepest/most specific)
      expect(containing_scope.type).toBe("method");
      expect(containing_scope.id).toBe(method_id);
    });
  });

  describe("Scope creation logic issues", () => {
    it("should create appropriate scope IDs for different entity types", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as any;

      const captures: NormalizedCapture[] = [
        {
          category: "scope" as any,
          entity: SemanticEntity.METHOD,
          text: "testMethod",
          node_location: { ...base_location, line: 5, end_line: 10 },
          modifiers: {},
        },
        {
          category: "scope" as any,
          entity: SemanticEntity.CONSTRUCTOR,
          text: "constructor",
          node_location: { ...base_location, line: 12, end_line: 15 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(captures, mockTree, file_path, "typescript");

      // Find the created scopes
      const method_scope = Array.from(result.scopes.values()).find(s => s.type === "method");
      const constructor_scope = Array.from(result.scopes.values()).find(s => s.type === "constructor");

      expect(method_scope).toBeDefined();
      expect(constructor_scope).toBeDefined();

      // Note: Both methods and constructors use function_scope creation
      // which is correct since no specific method_scope/constructor_scope functions exist
      expect(method_scope?.id).toMatch(/^function:/);
      expect(constructor_scope?.id).toMatch(/^function:/);
    });
  });

  describe("Root scope synchronization", () => {
    it("should keep root_scope reference in sync with scopes map", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as any;

      const captures: NormalizedCapture[] = [
        {
          category: "scope" as any,
          entity: SemanticEntity.FUNCTION,
          text: "testFunction",
          node_location: { ...base_location, line: 5, end_line: 10 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(captures, mockTree, file_path, "typescript");

      // The root scope returned should be identical to the one in the map
      const root_from_map = result.scopes.get(result.root_scope.id);

      expect(result.root_scope).toBe(root_from_map); // Should be same reference
      expect(result.root_scope.child_ids).toEqual(root_from_map?.child_ids);

      // BUG: Current implementation uses Object.assign which might cause
      // the root_scope reference to become out of sync
    });
  });

  describe("Edge cases that could cause errors", () => {
    it("should handle scopes with identical locations", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as any;

      // Two scopes with exactly the same location
      const identical_location = { ...base_location, line: 5, end_line: 10 };

      const captures: NormalizedCapture[] = [
        {
          category: "scope" as any,
          entity: SemanticEntity.FUNCTION,
          text: "func1",
          node_location: identical_location,
          modifiers: {},
        },
        {
          category: "scope" as any,
          entity: SemanticEntity.BLOCK,
          text: "block1",
          node_location: identical_location,
          modifiers: {},
        },
      ];

      expect(() => {
        build_scope_tree(captures, mockTree, file_path, "typescript");
      }).not.toThrow();
    });

    it("should handle zero-length scopes", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as any;

      const zero_length_location: Location = {
        file_path,
        line: 5,
        column: 10,
        end_line: 5,
        end_column: 10, // Same as start
      };

      const captures: NormalizedCapture[] = [
        {
          category: "scope" as any,
          entity: SemanticEntity.FUNCTION,
          text: "zeroLength",
          node_location: zero_length_location,
          modifiers: {},
        },
      ];

      expect(() => {
        build_scope_tree(captures, mockTree, file_path, "typescript");
      }).not.toThrow();
    });
  });
});