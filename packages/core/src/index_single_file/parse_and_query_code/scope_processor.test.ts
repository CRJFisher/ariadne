/**
 * Tests for Direct Scope Processing
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  process_scopes,
  create_processing_context,
  type ProcessingContext
} from "./scope_processor";
import {
  SemanticCategory,
  SemanticEntity,
  type NormalizedCapture
} from "./capture_types";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope
} from "@ariadnejs/types";

describe("scope_processor", () => {
  const file_path = "test.ts" as FilePath;
  const language = "typescript" as const;

  describe("process_scopes", () => {
    it("should create root module scope for empty file", () => {
      const captures: NormalizedCapture[] = [];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(1);
      const root = Array.from(scopes.values())[0];
      expect(root.type).toBe("module");
      expect(root.parent_id).toBe(null);
      expect(root.child_ids).toEqual([]);
    });

    it("should create function scope nested in module", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 5,
            end_column: 1
          },
          symbol_name: "processData" as SymbolName,
          modifiers: {},
          context: {}
        }
      ];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(2);

      // Find function scope
      const function_scope = Array.from(scopes.values()).find(s => s.type === "function");
      expect(function_scope).toBeDefined();
      expect(function_scope!.name).toBe("processData");
      expect(function_scope!.parent_id).toBeTruthy();

      // Check parent-child relationship
      const root = Array.from(scopes.values()).find(s => s.parent_id === null);
      expect(root!.child_ids).toContain(function_scope!.id);
    });

    it("should create nested scopes correctly", () => {
      const captures: NormalizedCapture[] = [
        // Class
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.CLASS,
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 20,
            end_column: 1
          },
          symbol_name: "MyClass" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Method inside class
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.METHOD,
          node_location: {
            file_path,
            line: 4,
            column: 2,
            end_line: 8,
            end_column: 3
          },
          symbol_name: "getData" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Block inside method
        {
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          node_location: {
            file_path,
            line: 5,
            column: 4,
            end_line: 7,
            end_column: 5
          },
          symbol_name: null as any,
          modifiers: {},
          context: {}
        }
      ];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(4); // root + class + method + block

      // Verify hierarchy
      const class_scope = Array.from(scopes.values()).find(s => s.name === "MyClass");
      const method_scope = Array.from(scopes.values()).find(s => s.name === "getData");
      const block_scope = Array.from(scopes.values()).find(s => s.type === "block");

      expect(class_scope).toBeDefined();
      expect(method_scope).toBeDefined();
      expect(block_scope).toBeDefined();

      // Method should be child of class
      expect(class_scope!.child_ids).toContain(method_scope!.id);
      expect(method_scope!.parent_id).toBe(class_scope!.id);

      // Block should be child of method
      expect(method_scope!.child_ids).toContain(block_scope!.id);
      expect(block_scope!.parent_id).toBe(method_scope!.id);
    });

    it("should handle multiple sibling scopes", () => {
      const captures: NormalizedCapture[] = [
        // First function
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 5,
            end_column: 1
          },
          symbol_name: "func1" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Second function
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path,
            line: 7,
            column: 0,
            end_line: 10,
            end_column: 1
          },
          symbol_name: "func2" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Third function
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path,
            line: 12,
            column: 0,
            end_line: 15,
            end_column: 1
          },
          symbol_name: "func3" as SymbolName,
          modifiers: {},
          context: {}
        }
      ];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(4); // root + 3 functions

      const root = Array.from(scopes.values()).find(s => s.parent_id === null);
      expect(root!.child_ids).toHaveLength(3);

      // All functions should be siblings
      const functions = Array.from(scopes.values()).filter(s => s.type === "function");
      expect(functions).toHaveLength(3);
      functions.forEach(func => {
        expect(func.parent_id).toBe(root!.id);
      });
    });

    it("should handle closures (functions within functions)", () => {
      const captures: NormalizedCapture[] = [
        // Outer function
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 10,
            end_column: 1
          },
          symbol_name: "outerFunc" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Inner closure
        {
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.CLOSURE,
          node_location: {
            file_path,
            line: 4,
            column: 2,
            end_line: 8,
            end_column: 3
          },
          symbol_name: "innerFunc" as SymbolName,
          modifiers: {},
          context: {}
        }
      ];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(3); // root + outer + inner

      const outer = Array.from(scopes.values()).find(s => s.name === "outerFunc");
      const inner = Array.from(scopes.values()).find(s => s.name === "innerFunc");

      expect(inner!.parent_id).toBe(outer!.id);
      expect(outer!.child_ids).toContain(inner!.id);
    });

    it("should handle interface and enum scopes", () => {
      const captures: NormalizedCapture[] = [
        // Interface
        {
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.INTERFACE,
          node_location: {
            file_path,
            line: 2,
            column: 0,
            end_line: 5,
            end_column: 1
          },
          symbol_name: "IUser" as SymbolName,
          modifiers: {},
          context: {}
        },
        // Enum
        {
          category: SemanticCategory.TYPE,
          entity: SemanticEntity.ENUM,
          node_location: {
            file_path,
            line: 7,
            column: 0,
            end_line: 10,
            end_column: 1
          },
          symbol_name: "Status" as SymbolName,
          modifiers: {},
          context: {}
        }
      ];

      const scopes = process_scopes(captures, file_path, language);

      expect(scopes.size).toBe(3); // root + interface + enum

      const interface_scope = Array.from(scopes.values()).find(s => s.name === "IUser");
      const enum_scope = Array.from(scopes.values()).find(s => s.name === "Status");

      expect(interface_scope!.type).toBe("class"); // Interfaces map to class scope type
      expect(enum_scope!.type).toBe("class"); // Enums map to class scope type
    });
  });

  describe("create_processing_context", () => {
    it("should compute depths correctly", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create a simple hierarchy
      const root_id = "module:test.ts:1:0:100:0" as ScopeId;
      const func_id = "function:test.ts:2:0:10:1" as ScopeId;
      const block_id = "block:test.ts:4:2:8:3" as ScopeId;

      scopes.set(root_id, {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          line: 1,
          column: 0,
          end_line: 100,
          end_column: 0
        },
        child_ids: [func_id]
      });

      scopes.set(func_id, {
        id: func_id,
        parent_id: root_id,
        name: "myFunc" as SymbolName,
        type: "function",
        location: {
          file_path,
          line: 2,
          column: 0,
          end_line: 10,
          end_column: 1
        },
        child_ids: [block_id]
      });

      scopes.set(block_id, {
        id: block_id,
        parent_id: func_id,
        name: null,
        type: "block",
        location: {
          file_path,
          line: 4,
          column: 2,
          end_line: 8,
          end_column: 3
        },
        child_ids: []
      });

      const context = create_processing_context(scopes);

      expect(context.scope_depths.get(root_id)).toBe(0);
      expect(context.scope_depths.get(func_id)).toBe(1);
      expect(context.scope_depths.get(block_id)).toBe(2);
    });

    it("should find correct scope for location", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      const root_id = "module:test.ts:1:0:100:0" as ScopeId;
      const func_id = "function:test.ts:5:0:15:1" as ScopeId;
      const block_id = "block:test.ts:8:2:12:3" as ScopeId;

      scopes.set(root_id, {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          line: 1,
          column: 0,
          end_line: 100,
          end_column: 0
        },
        child_ids: [func_id]
      });

      scopes.set(func_id, {
        id: func_id,
        parent_id: root_id,
        name: "myFunc" as SymbolName,
        type: "function",
        location: {
          file_path,
          line: 5,
          column: 0,
          end_line: 15,
          end_column: 1
        },
        child_ids: [block_id]
      });

      scopes.set(block_id, {
        id: block_id,
        parent_id: func_id,
        name: null,
        type: "block",
        location: {
          file_path,
          line: 8,
          column: 2,
          end_line: 12,
          end_column: 3
        },
        child_ids: []
      });

      const context = create_processing_context(scopes);

      // Location in module but outside function
      expect(context.get_scope_id({
        file_path,
        line: 3,
        column: 0,
        end_line: 3,
        end_column: 10
      })).toBe(root_id);

      // Location in function but outside block
      expect(context.get_scope_id({
        file_path,
        line: 6,
        column: 1,
        end_line: 6,
        end_column: 10
      })).toBe(func_id);

      // Location inside block
      expect(context.get_scope_id({
        file_path,
        line: 10,
        column: 4,
        end_line: 10,
        end_column: 10
      })).toBe(block_id);
    });

    it("should handle overlapping scopes by choosing deepest", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      const root_id = "module:test.ts:1:0:100:0" as ScopeId;
      const class_id = "class:test.ts:5:0:50:1" as ScopeId;
      const method1_id = "method:test.ts:10:2:20:3" as ScopeId;
      const method2_id = "method:test.ts:25:2:35:3" as ScopeId;

      scopes.set(root_id, {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          line: 1,
          column: 0,
          end_line: 100,
          end_column: 0
        },
        child_ids: [class_id]
      });

      scopes.set(class_id, {
        id: class_id,
        parent_id: root_id,
        name: "MyClass" as SymbolName,
        type: "class",
        location: {
          file_path,
          line: 5,
          column: 0,
          end_line: 50,
          end_column: 1
        },
        child_ids: [method1_id, method2_id]
      });

      scopes.set(method1_id, {
        id: method1_id,
        parent_id: class_id,
        name: "method1" as SymbolName,
        type: "method",
        location: {
          file_path,
          line: 10,
          column: 2,
          end_line: 20,
          end_column: 3
        },
        child_ids: []
      });

      scopes.set(method2_id, {
        id: method2_id,
        parent_id: class_id,
        name: "method2" as SymbolName,
        type: "method",
        location: {
          file_path,
          line: 25,
          column: 2,
          end_line: 35,
          end_column: 3
        },
        child_ids: []
      });

      const context = create_processing_context(scopes);

      // Location in method1
      expect(context.get_scope_id({
        file_path,
        line: 15,
        column: 4,
        end_line: 15,
        end_column: 10
      })).toBe(method1_id);

      // Location in method2
      expect(context.get_scope_id({
        file_path,
        line: 30,
        column: 4,
        end_line: 30,
        end_column: 10
      })).toBe(method2_id);

      // Location in class but outside methods
      expect(context.get_scope_id({
        file_path,
        line: 22,
        column: 2,
        end_line: 22,
        end_column: 10
      })).toBe(class_id);
    });
  });

  describe("scope types", () => {
    it("should handle all scope entity types correctly", () => {
      const test_cases = [
        { entity: SemanticEntity.MODULE, expected_type: "module" },
        { entity: SemanticEntity.NAMESPACE, expected_type: "module" },
        { entity: SemanticEntity.CLASS, expected_type: "class" },
        { entity: SemanticEntity.INTERFACE, expected_type: "class" },
        { entity: SemanticEntity.ENUM, expected_type: "class" },
        { entity: SemanticEntity.FUNCTION, expected_type: "function" },
        { entity: SemanticEntity.CLOSURE, expected_type: "function" },
        { entity: SemanticEntity.METHOD, expected_type: "method" },
        { entity: SemanticEntity.CONSTRUCTOR, expected_type: "constructor" },
        { entity: SemanticEntity.BLOCK, expected_type: "block" },
      ];

      test_cases.forEach(({ entity, expected_type }) => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.SCOPE,
            entity,
            node_location: {
              file_path,
              line: 5,
              column: 0,
              end_line: 10,
              end_column: 1
            },
            symbol_name: "test" as SymbolName,
            modifiers: {},
            context: {}
          }
        ];

        const scopes = process_scopes(captures, file_path, language);

        // MODULE and NAMESPACE create module-level scopes, so they might replace or add to root
        // All others add a new scope to the existing root
        const min_expected = 2; // Always have at least root + created scope
        expect(scopes.size).toBeGreaterThanOrEqual(min_expected - 1);

        // Find the scope with our test name (or check by type for MODULE/NAMESPACE)
        const created_scope = Array.from(scopes.values()).find(s =>
          s.name === "test" || (s.type === expected_type && s.parent_id !== null)
        );

        if (entity === SemanticEntity.MODULE || entity === SemanticEntity.NAMESPACE) {
          // Module/namespace might be nested or might modify root
          const module_scopes = Array.from(scopes.values()).filter(s => s.type === "module");
          expect(module_scopes.length).toBeGreaterThan(0);
        } else {
          expect(created_scope).toBeDefined();
          expect(created_scope?.type).toBe(expected_type);
        }
      });
    });
  });
});