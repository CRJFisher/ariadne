/**
 * Comprehensive tests for scope_tree module
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import Parser from "tree-sitter";
import type { Tree } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type {
  FilePath,
  ScopeId,
  LexicalScope,
  Location,
  Language,
} from "@ariadnejs/types";
import {
  module_scope,
  function_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import {
  build_scope_tree,
  compute_scope_depth,
  find_containing_scope,
  map_entity_to_scope_type,
} from "./scope_tree";
import { SemanticEntity, SemanticCategory } from "../capture_types";
import type { NormalizedCapture } from "../capture_types";

describe("Scope Tree Module", () => {
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

  describe("build_scope_tree", () => {
    it("should create root scope for empty captures", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const result = build_scope_tree([], mockTree, file_path, "typescript");

      expect(result.root_scope).toBeDefined();
      expect(result.root_scope.type).toBe("module");
      expect(result.root_scope.parent_id).toBeNull();
      expect(result.root_scope.child_ids).toEqual([]);
      expect(result.scopes.size).toBe(1);
    });

    it("should build simple function scope", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "testFunction",
          node_location: { ...base_location, line: 2, end_line: 5 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      expect(result.scopes.size).toBe(2); // root + function
      expect(result.root_scope.child_ids.length).toBe(1);

      const function_scope_id = result.root_scope.child_ids[0];
      const function_scope = result.scopes.get(function_scope_id);

      expect(function_scope).toBeDefined();
      expect(function_scope!.type).toBe("function");
      expect(function_scope!.parent_id).toBe(result.root_scope.id);
    });

    it("should build nested scopes", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.CLASS,
          text: "TestClass",
          node_location: { ...base_location, line: 2, end_line: 15 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.METHOD,
          text: "testMethod",
          node_location: { ...base_location, line: 5, end_line: 10 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          text: "block",
          node_location: { ...base_location, line: 7, end_line: 9 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      expect(result.scopes.size).toBe(4); // root + class + method + block

      // Find scopes by type
      const class_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "class"
      );
      const method_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "method"
      );
      const block_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "block"
      );

      expect(class_scope).toBeDefined();
      expect(method_scope).toBeDefined();
      expect(block_scope).toBeDefined();

      // Check hierarchy
      expect(class_scope!.parent_id).toBe(result.root_scope.id);
      expect(method_scope!.parent_id).toBe(class_scope!.id);
      expect(block_scope!.parent_id).toBe(method_scope!.id);
    });

    it("should handle different scope types", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 50, column: 50 },
          startIndex: 0,
          endIndex: 500,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func",
          node_location: { ...base_location, line: 2, end_line: 5 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.CLASS,
          text: "Class",
          node_location: { ...base_location, line: 10, end_line: 20 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.METHOD,
          text: "method",
          node_location: { ...base_location, line: 12, end_line: 15 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.CONSTRUCTOR,
          text: "constructor",
          node_location: { ...base_location, line: 16, end_line: 18 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          text: "block",
          node_location: { ...base_location, line: 25, end_line: 30 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      const scope_types = Array.from(result.scopes.values()).map((s) => s.type);
      expect(scope_types).toContain("module");
      expect(scope_types).toContain("function");
      expect(scope_types).toContain("class");
      expect(scope_types).toContain("method");
      expect(scope_types).toContain("constructor");
      expect(scope_types).toContain("block");
    });

    it("should sort captures by position", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as unknown as Tree;

      // Out of order captures
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func2",
          node_location: { ...base_location, line: 10, end_line: 15 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func1",
          node_location: { ...base_location, line: 5, end_line: 8 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          text: "block",
          node_location: { ...base_location, line: 6, end_line: 7 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      // Should process in correct order: func1, block (inside func1), func2
      expect(result.scopes.size).toBe(4); // root + 2 functions + block

      // The block should be a child of func1, not func2
      const func1_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "function" && s.location.line === 5
      );
      const block_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "block"
      );

      expect(block_scope!.parent_id).toBe(func1_scope!.id);
    });

    it("should skip module entities", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.MODULE,
          text: "module",
          node_location: base_location,
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func",
          node_location: { ...base_location, line: 2 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      // Should only have root + function, module capture should be skipped
      expect(result.scopes.size).toBe(2);
    });

    it("should handle same line different column sorting", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func2",
          node_location: { ...base_location, line: 5, column: 20, end_line: 8 },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func1",
          node_location: { ...base_location, line: 5, column: 10, end_line: 7 },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      expect(result.scopes.size).toBe(3); // root + 2 functions

      // Due to overlapping scopes, one function may be contained within the other
      expect(result.root_scope.child_ids.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("compute_scope_depth", () => {
    let scopes: Map<ScopeId, LexicalScope>;
    let root_scope: LexicalScope;

    beforeEach(() => {
      scopes = new Map();

      // Create a hierarchy: root -> class -> method -> block
      const root_id = module_scope(base_location);
      root_scope = {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: base_location,
        child_ids: [],
        symbols: new Map(),
      };

      const class_id = class_scope({ ...base_location, line: 2 });
      const class_scope_obj: LexicalScope = {
        id: class_id,
        parent_id: root_id,
        name: null,
        type: "class",
        location: { ...base_location, line: 2 },
        child_ids: [],
        symbols: new Map(),
      };

      const method_id = function_scope({ ...base_location, line: 3 });
      const method_scope_obj: LexicalScope = {
        id: method_id,
        parent_id: class_id,
        name: null,
        type: "method",
        location: { ...base_location, line: 3 },
        child_ids: [],
        symbols: new Map(),
      };

      const block_id = block_scope({ ...base_location, line: 4 });
      const block_scope_obj: LexicalScope = {
        id: block_id,
        parent_id: method_id,
        name: null,
        type: "block",
        location: { ...base_location, line: 4 },
        child_ids: [],
        symbols: new Map(),
      };

      scopes.set(root_id, root_scope);
      scopes.set(class_id, class_scope_obj);
      scopes.set(method_id, method_scope_obj);
      scopes.set(block_id, block_scope_obj);
    });

    it("should compute correct depth for root scope", () => {
      const depth = compute_scope_depth(root_scope, scopes);
      expect(depth).toBe(0);
    });

    it("should compute correct depth for nested scopes", () => {
      const class_scope = Array.from(scopes.values()).find(
        (s) => s.type === "class"
      )!;
      const method_scope = Array.from(scopes.values()).find(
        (s) => s.type === "method"
      )!;
      const block_scope = Array.from(scopes.values()).find(
        (s) => s.type === "block"
      )!;

      expect(compute_scope_depth(class_scope, scopes)).toBe(1);
      expect(compute_scope_depth(method_scope, scopes)).toBe(2);
      expect(compute_scope_depth(block_scope, scopes)).toBe(3);
    });

    it("should handle missing parent scope", () => {
      const orphan_scope: LexicalScope = {
        id: "orphan" as ScopeId,
        parent_id: "nonexistent" as ScopeId,
        name: null,
        type: "function",
        location: base_location,
        child_ids: [],
        symbols: new Map(),
      };

      const depth = compute_scope_depth(orphan_scope, scopes);
      expect(depth).toBe(0); // Should not increment depth for non-existent parents
    });

    it("should prevent infinite loops with circular references", () => {
      // Create circular reference
      const scope_a_id = "scope_a" as ScopeId;
      const scope_b_id = "scope_b" as ScopeId;

      const scope_a: LexicalScope = {
        id: scope_a_id,
        parent_id: scope_b_id,
        name: null,
        type: "function",
        location: { ...base_location, line: 10 },
        child_ids: [],
        symbols: new Map(),
      };

      const scope_b: LexicalScope = {
        id: scope_b_id,
        parent_id: scope_a_id,
        name: null,
        type: "function",
        location: { ...base_location, line: 11 },
        child_ids: [],
        symbols: new Map(),
      };

      const circular_scopes = new Map([
        [scope_a_id, scope_a],
        [scope_b_id, scope_b],
      ]);

      // Should not hang or crash
      const depth = compute_scope_depth(scope_a, circular_scopes);
      expect(depth).toBe(2); // Will traverse a->b->a and then detect cycle
    });
  });

  describe("find_containing_scope", () => {
    let scopes: Map<ScopeId, LexicalScope>;
    let root_scope: LexicalScope;

    beforeEach(() => {
      scopes = new Map();

      // Create a hierarchy with overlapping scopes
      const root_location: Location = {
        file_path,
        line: 1,
        column: 0,
        end_line: 20,
        end_column: 100,
      };

      const root_id = module_scope(root_location);
      root_scope = {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: root_location,
        child_ids: [],
        symbols: new Map(),
      };

      const class_location: Location = {
        file_path,
        line: 5,
        column: 0,
        end_line: 15,
        end_column: 50,
      };

      const class_id = class_scope(class_location);
      const class_scope_obj: LexicalScope = {
        id: class_id,
        parent_id: root_id,
        name: null,
        type: "class",
        location: class_location,
        child_ids: [],
        symbols: new Map(),
      };

      const method_location: Location = {
        file_path,
        line: 8,
        column: 4,
        end_line: 12,
        end_column: 20,
      };

      const method_id = function_scope(method_location);
      const method_scope_obj: LexicalScope = {
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
      scopes.set(method_id, method_scope_obj);
    });

    it("should find root scope for location outside all scopes", () => {
      const location: Location = {
        file_path,
        line: 2,
        column: 0,
        end_line: 2,
        end_column: 10,
      };

      const containing_scope = find_containing_scope(
        location,
        root_scope,
        scopes
      );
      expect(containing_scope.type).toBe("module");
    });

    it("should find class scope for location inside class but outside method", () => {
      const location: Location = {
        file_path,
        line: 6,
        column: 2,
        end_line: 6,
        end_column: 10,
      };

      const containing_scope = find_containing_scope(
        location,
        root_scope,
        scopes
      );
      expect(containing_scope.type).toBe("class");
    });

    it("should find deepest containing scope", () => {
      const location: Location = {
        file_path,
        line: 10,
        column: 8,
        end_line: 10,
        end_column: 15,
      };

      const containing_scope = find_containing_scope(
        location,
        root_scope,
        scopes
      );
      expect(containing_scope.type).toBe("method");
    });

    it("should handle location exactly at scope boundaries", () => {
      // Location at start of class scope
      const start_location: Location = {
        file_path,
        line: 5,
        column: 0,
        end_line: 5,
        end_column: 5,
      };

      const containing_scope = find_containing_scope(
        start_location,
        root_scope,
        scopes
      );
      expect(containing_scope.type).toBe("class");
    });

    it("should return root scope when no containing scope found", () => {
      const location: Location = {
        file_path,
        line: 100, // Far outside any scope
        column: 0,
        end_line: 100,
        end_column: 10,
      };

      const containing_scope = find_containing_scope(
        location,
        root_scope,
        scopes
      );
      expect(containing_scope.type).toBe("module");
    });

    it("should handle empty scopes map", () => {
      const empty_scopes = new Map();
      const location: Location = {
        file_path,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 10,
      };

      const containing_scope = find_containing_scope(
        location,
        root_scope,
        empty_scopes
      );
      expect(containing_scope).toBe(root_scope);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed captures gracefully", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: "invalid_entity" as SemanticEntity,
          text: "invalid",
          node_location: base_location,
          modifiers: {},
        },
      ];

      expect(() => {
        build_scope_tree(captures, mockTree, file_path, "typescript");
      }).not.toThrow();
    });

    it("should handle null or undefined locations", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 50 },
          startIndex: 0,
          endIndex: 100,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "func",
          node_location: {
            file_path,
            line: -1,
            column: -1,
            end_line: -1,
            end_column: -1,
          },
          modifiers: {},
        },
      ];

      expect(() => {
        build_scope_tree(captures, mockTree, file_path, "typescript");
      }).not.toThrow();
    });

    it("should handle very deeply nested scopes", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 1000, column: 50 },
          startIndex: 0,
          endIndex: 10000,
        },
      } as unknown as Tree;

      // Create 100 nested scopes
      const captures: NormalizedCapture[] = Array.from(
        { length: 100 },
        (_, i) => ({
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          text: `block_${i}`,
          node_location: {
            file_path,
            line: i + 2,
            column: i,
            end_line: 100 - i,
            end_column: 50,
          },
          modifiers: {},
        })
      );

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      expect(result.scopes.size).toBe(101); // root + 100 blocks

      // Check that we can compute depth without issues
      const deepest_scope = Array.from(result.scopes.values()).reduce(
        (deepest, scope) => {
          const depth = compute_scope_depth(scope, result.scopes);
          const deepest_depth = compute_scope_depth(deepest, result.scopes);
          return depth > deepest_depth ? scope : deepest;
        }
      );

      const max_depth = compute_scope_depth(deepest_scope, result.scopes);
      expect(max_depth).toBeGreaterThan(0);
      expect(max_depth).toBeLessThanOrEqual(100);
    });

    it("should handle overlapping scopes correctly", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 20, column: 50 },
          startIndex: 0,
          endIndex: 200,
        },
      } as unknown as Tree;

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "outer",
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 15,
            end_column: 50,
          },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: "inner",
          node_location: {
            file_path,
            line: 5,
            column: 4,
            end_line: 10,
            end_column: 30,
          },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );

      expect(result.scopes.size).toBe(3); // root + outer + inner

      const outer_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "function" && s.location.line === 2
      );
      const inner_scope = Array.from(result.scopes.values()).find(
        (s) => s.type === "function" && s.location.line === 5
      );

      expect(outer_scope!.parent_id).toBe(result.root_scope.id);
      expect(inner_scope!.parent_id).toBe(outer_scope!.id);
    });
  });

  describe("Integration with Real Parsers", () => {
    let typescript_parser: Parser;
    let python_parser: Parser;
    let rust_parser: Parser;

    beforeAll(() => {
      typescript_parser = new Parser();
      typescript_parser.setLanguage(TypeScript.tsx);

      python_parser = new Parser();
      python_parser.setLanguage(Python);

      rust_parser = new Parser();
      rust_parser.setLanguage(Rust);
    });

    it("should work with real TypeScript code", () => {
      const code = `
        class TestClass {
          method() {
            function inner() {
              if (true) {
                // block scope
              }
            }
          }
        }
      `;

      const tree = typescript_parser.parse(code);

      // Create mock captures that would come from tree-sitter queries
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.CLASS,
          text: "TestClass",
          node_location: {
            file_path: "test.ts" as FilePath,
            line: 2,
            column: 8,
            end_line: 10,
            end_column: 9,
          },
          modifiers: {},
        },
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.METHOD,
          text: "method",
          node_location: {
            file_path: "test.ts" as FilePath,
            line: 3,
            column: 10,
            end_line: 9,
            end_column: 11,
          },
          modifiers: {},
        },
      ];

      const result = build_scope_tree(
        captures,
        tree,
        "test.ts" as FilePath,
        "typescript"
      );

      expect(result.scopes.size).toBeGreaterThanOrEqual(3); // root + class + method
      expect(result.root_scope.type).toBe("module");
    });

    it("should handle empty code", () => {
      const code = "";
      const tree = typescript_parser.parse(code);

      const result = build_scope_tree(
        [],
        tree,
        "empty.ts" as FilePath,
        "typescript"
      );

      expect(result.scopes.size).toBe(1); // Only root scope
      expect(result.root_scope.type).toBe("module");
    });

    it("should handle malformed code", () => {
      const code = `
        class {
          method( {
            // malformed
        }
      `;

      const tree = typescript_parser.parse(code);

      expect(() => {
        build_scope_tree([], tree, "malformed.ts" as FilePath, "typescript");
      }).not.toThrow();
    });
  });

  describe("map_entity_to_scope_type", () => {
    it("should map all supported semantic entities to scope types", () => {
      expect(map_entity_to_scope_type(SemanticEntity.MODULE)).toBe("module");
      expect(map_entity_to_scope_type(SemanticEntity.CLASS)).toBe("class");
      expect(map_entity_to_scope_type(SemanticEntity.FUNCTION)).toBe(
        "function"
      );
      expect(map_entity_to_scope_type(SemanticEntity.METHOD)).toBe("method");
      expect(map_entity_to_scope_type(SemanticEntity.CONSTRUCTOR)).toBe(
        "constructor"
      );
      expect(map_entity_to_scope_type(SemanticEntity.BLOCK)).toBe("block");
    });

    it("should default to 'block' for unknown entity types", () => {
      const unknownEntity = "UNKNOWN_ENTITY" as SemanticEntity;
      expect(map_entity_to_scope_type(unknownEntity)).toBe("block");
    });

    it("should handle all semantic entities that could be scopes", () => {
      // Test entities that might be passed but should default to 'block'
      expect(map_entity_to_scope_type(SemanticEntity.VARIABLE)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.CONSTANT)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.PARAMETER)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.FIELD)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.PROPERTY)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.INTERFACE)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.ENUM)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.TYPE_ALIAS)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.ENUM_MEMBER)).toBe(
        "block"
      );
      expect(map_entity_to_scope_type(SemanticEntity.NAMESPACE)).toBe("block");
      expect(map_entity_to_scope_type(SemanticEntity.TYPE_PARAMETER)).toBe(
        "block"
      );
    });
  });

  describe("Performance Tests", () => {
    it("should handle large numbers of scopes efficiently", () => {
      const mockTree = {
        rootNode: {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10000, column: 50 },
          startIndex: 0,
          endIndex: 100000,
        },
      } as unknown as Tree;

      // Create 1000 scopes
      const captures: NormalizedCapture[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.FUNCTION,
          text: `func_${i}`,
          node_location: {
            file_path,
            line: i + 2,
            column: 0,
            end_line: i + 3,
            end_column: 50,
          },
          modifiers: {},
        })
      );

      const start_time = Date.now();
      const result = build_scope_tree(
        captures,
        mockTree,
        file_path,
        "typescript"
      );
      const end_time = Date.now();

      expect(end_time - start_time).toBeLessThan(2000); // Should complete in reasonable time
      expect(result.scopes.size).toBe(1001); // root + 1000 functions
    });

    it("should handle find_containing_scope efficiently with many scopes", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create root
      const root_id = module_scope(base_location);
      const root_scope: LexicalScope = {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          line: 1,
          column: 0,
          end_line: 10000,
          end_column: 100,
        },
        child_ids: [],
        symbols: new Map(),
      };
      scopes.set(root_id, root_scope);

      // Create 1000 scopes
      for (let i = 0; i < 1000; i++) {
        const scope_id = function_scope({
          file_path,
          line: i + 10,
          column: 0,
          end_line: i + 11,
          end_column: 50,
        });

        const scope: LexicalScope = {
          id: scope_id,
          parent_id: root_id,
          name: null,
          type: "function",
          location: {
            file_path,
            line: i + 10,
            column: 0,
            end_line: i + 11,
            end_column: 50,
          },
          child_ids: [],
          symbols: new Map(),
        };

        scopes.set(scope_id, scope);
      }

      const test_location: Location = {
        file_path,
        line: 500,
        column: 25,
        end_line: 500,
        end_column: 30,
      };

      const start_time = Date.now();
      const containing_scope = find_containing_scope(
        test_location,
        root_scope,
        scopes
      );
      const end_time = Date.now();

      expect(end_time - start_time).toBeLessThan(100); // Should be very fast
      expect(containing_scope.type).toBe("function");
    });
  });
});
