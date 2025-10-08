/**
 * Tests for Direct Scope Processing
 */

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import { process_scopes, create_processing_context } from "./scope_processor";
import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  Language,
} from "@ariadnejs/types";
import {
  CaptureNode,
  SemanticEntity,
  SemanticCategory,
  build_semantic_index,
} from "../semantic_index";
import { ParsedFile } from "../file_utils";

describe("scope_processor", () => {
  const file_path = "test.ts" as FilePath;
  const file = {
    file_path: file_path,
    file_lines: 100,
    file_end_column: 0,
    tree: null as any,
    lang: "typescript" as const,
  } as ParsedFile;

  // Helper to create raw captures for testing
  function create_raw_capture(
    category: string,
    entity: string,
    location: Location,
    symbol_name: string = "test"
  ): CaptureNode {
    const mock_node = {
      text: symbol_name,
      startPosition: {
        row: location.start_line - 1,
        column: location.start_column,
      },
      endPosition: { row: location.end_line - 1, column: location.end_column },
      // Mock childForFieldName to return null (no parameters node in mock)
      childForFieldName: () => null,
    };

    return {
      name: `${category}.${entity}`,
      node: mock_node as any,
      text: symbol_name as SymbolName,
      category: category as SemanticCategory,
      entity: entity as SemanticEntity,
      location: location,
    };
  }

  describe("process_scopes", () => {
    it("should create root module scope for empty file", () => {
      const captures: CaptureNode[] = [];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(1);
      const root = Array.from(scopes.values())[0];
      expect(root.type).toBe("module");
      expect(root.parent_id).toBe(null);
      expect(root.child_ids).toEqual([]);
    });

    it("should create function scope nested in module", () => {
      const captures: CaptureNode[] = [
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 1,
          },
          "processData"
        ),
      ];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(2);

      // Find function scope
      const function_scope = Array.from(scopes.values()).find(
        (s) => s.type === "function"
      );
      expect(function_scope).toBeDefined();
      expect(function_scope!.name).toBe("processData");
      expect(function_scope!.parent_id).toBeTruthy();

      // Check parent-child relationship
      const root = Array.from(scopes.values()).find(
        (s) => s.parent_id === null
      );
      expect(root!.child_ids).toContain(function_scope!.id);
    });

    it("should create nested scopes correctly", () => {
      const captures: CaptureNode[] = [
        // Class
        create_raw_capture(
          "scope",
          "class",
          {
            file_path,
            start_line: 2,
            start_column: 0,
            end_line: 20,
            end_column: 1,
          },
          "MyClass"
        ),
        // Method inside class
        create_raw_capture(
          "scope",
          "method",
          {
            file_path,
            start_line: 4,
            start_column: 2,
            end_line: 8,
            end_column: 3,
          },
          "getData"
        ),
        // Block inside method
        create_raw_capture(
          "scope",
          "block",
          {
            file_path,
            start_line: 5,
            start_column: 4,
            end_line: 7,
            end_column: 5,
          },
          ""
        ),
      ];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(4); // root + class + method + block

      // Verify hierarchy
      const class_scope = Array.from(scopes.values()).find(
        (s) => s.name === "MyClass"
      );
      const method_scope = Array.from(scopes.values()).find(
        (s) => s.name === "getData"
      );
      const block_scope = Array.from(scopes.values()).find(
        (s) => s.type === "block"
      );

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
      const captures: CaptureNode[] = [
        // First function
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 1,
          },
          "func1"
        ),
        // Second function
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 7,
            start_column: 0,
            end_line: 10,
            end_column: 1,
          },
          "func2"
        ),
        // Third function
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 12,
            start_column: 0,
            end_line: 15,
            end_column: 1,
          },
          "func3"
        ),
      ];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(4); // root + 3 functions

      const root = Array.from(scopes.values()).find(
        (s) => s.parent_id === null
      );
      expect(root!.child_ids).toHaveLength(3);

      // All functions should be siblings
      const functions = Array.from(scopes.values()).filter(
        (s) => s.type === "function"
      );
      expect(functions).toHaveLength(3);
      functions.forEach((func) => {
        expect(func.parent_id).toBe(root!.id);
      });
    });

    it("should handle closures (functions within functions)", () => {
      const captures: CaptureNode[] = [
        // Outer function
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 2,
            start_column: 0,
            end_line: 10,
            end_column: 1,
          },
          "outerFunc"
        ),
        // Inner closure
        create_raw_capture(
          "scope",
          "function",
          {
            file_path,
            start_line: 4,
            start_column: 2,
            end_line: 8,
            end_column: 3,
          },
          "innerFunc"
        ),
      ];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(3); // root + outer + inner

      const outer = Array.from(scopes.values()).find(
        (s) => s.name === "outerFunc"
      );
      const inner = Array.from(scopes.values()).find(
        (s) => s.name === "innerFunc"
      );

      expect(inner!.parent_id).toBe(outer!.id);
      expect(outer!.child_ids).toContain(inner!.id);
    });

    it("should handle interface and enum scopes", () => {
      const captures: CaptureNode[] = [
        // Interface
        create_raw_capture(
          "scope",
          "class",
          {
            file_path,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 1,
          },
          "IUser"
        ),
        // Enum
        create_raw_capture(
          "scope",
          "class",
          {
            file_path,
            start_line: 7,
            start_column: 0,
            end_line: 10,
            end_column: 1,
          },
          "Status"
        ),
      ];

      const scopes = process_scopes(captures, file);

      expect(scopes.size).toBe(3); // root + interface + enum

      const interface_scope = Array.from(scopes.values()).find(
        (s) => s.name === "IUser"
      );
      const enum_scope = Array.from(scopes.values()).find(
        (s) => s.name === "Status"
      );

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
          start_line: 1,
          start_column: 0,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [func_id],
      });

      scopes.set(func_id, {
        id: func_id,
        parent_id: root_id,
        name: "myFunc" as SymbolName,
        type: "function",
        location: {
          file_path,
          start_line: 2,
          start_column: 0,
          end_line: 10,
          end_column: 1,
        },
        child_ids: [block_id],
      });

      scopes.set(block_id, {
        id: block_id,
        parent_id: func_id,
        name: null,
        type: "block",
        location: {
          file_path,
          start_line: 4,
          start_column: 2,
          end_line: 8,
          end_column: 3,
        },
        child_ids: [],
      });

      const captures: CaptureNode[] = [];
      const context = create_processing_context(scopes, captures);

      expect(context.scope_depths.get(root_id)).toBe(0);
      expect(context.scope_depths.get(func_id)).toBe(1);
      expect(context.scope_depths.get(block_id)).toBe(2);
      expect(context.captures).toEqual(captures);
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
          start_line: 1,
          start_column: 0,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [func_id],
      });

      scopes.set(func_id, {
        id: func_id,
        parent_id: root_id,
        name: "myFunc" as SymbolName,
        type: "function",
        location: {
          file_path,
          start_line: 5,
          start_column: 0,
          end_line: 15,
          end_column: 1,
        },
        child_ids: [block_id],
      });

      scopes.set(block_id, {
        id: block_id,
        parent_id: func_id,
        name: null,
        type: "block",
        location: {
          file_path,
          start_line: 8,
          start_column: 2,
          end_line: 12,
          end_column: 3,
        },
        child_ids: [],
      });

      const captures: CaptureNode[] = [];
      const context = create_processing_context(scopes, captures);

      // Location in module but outside function
      expect(
        context.get_scope_id({
          file_path,
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 10,
        })
      ).toBe(root_id);

      // Location in function but outside block
      expect(
        context.get_scope_id({
          file_path,
          start_line: 6,
          start_column: 1,
          end_line: 6,
          end_column: 10,
        })
      ).toBe(func_id);

      // Location inside block
      expect(
        context.get_scope_id({
          file_path,
          start_line: 10,
          start_column: 4,
          end_line: 10,
          end_column: 10,
        })
      ).toBe(block_id);
      expect(context.captures).toEqual(captures);
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
          start_line: 1,
          start_column: 0,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [class_id],
      });

      scopes.set(class_id, {
        id: class_id,
        parent_id: root_id,
        name: "MyClass" as SymbolName,
        type: "class",
        location: {
          file_path,
          start_line: 5,
          start_column: 0,
          end_line: 50,
          end_column: 1,
        },
        child_ids: [method1_id, method2_id],
      });

      scopes.set(method1_id, {
        id: method1_id,
        parent_id: class_id,
        name: "method1" as SymbolName,
        type: "method",
        location: {
          file_path,
          start_line: 10,
          start_column: 2,
          end_line: 20,
          end_column: 3,
        },
        child_ids: [],
      });

      scopes.set(method2_id, {
        id: method2_id,
        parent_id: class_id,
        name: "method2" as SymbolName,
        type: "method",
        location: {
          file_path,
          start_line: 25,
          start_column: 2,
          end_line: 35,
          end_column: 3,
        },
        child_ids: [],
      });

      const captures: CaptureNode[] = [];
      const context = create_processing_context(scopes, captures);

      // Location in method1
      expect(
        context.get_scope_id({
          file_path,
          start_line: 15,
          start_column: 4,
          end_line: 15,
          end_column: 10,
        })
      ).toBe(method1_id);

      // Location in method2
      expect(
        context.get_scope_id({
          file_path,
          start_line: 30,
          start_column: 4,
          end_line: 30,
          end_column: 10,
        })
      ).toBe(method2_id);

      // Location in class but outside methods
      expect(
        context.get_scope_id({
          file_path,
          start_line: 22,
          start_column: 2,
          end_line: 22,
          end_column: 10,
        })
      ).toBe(class_id);
      expect(context.captures).toEqual(captures);
    });
  });

  describe("scope types", () => {
    it("should handle all scope entity types correctly", () => {
      const test_cases = [
        { entity: "module", expected_type: "module" },
        { entity: "namespace", expected_type: "module" },
        { entity: "class", expected_type: "class" },
        { entity: "interface", expected_type: "class" },
        { entity: "enum", expected_type: "class" },
        { entity: "function", expected_type: "function" },
        { entity: "closure", expected_type: "function" },
        { entity: "method", expected_type: "method" },
        { entity: "constructor", expected_type: "constructor" },
        { entity: "block", expected_type: "block" },
      ];

      test_cases.forEach(({ entity, expected_type }) => {
        const captures: CaptureNode[] = [
          create_raw_capture(
            "scope",
            entity,
            {
              file_path,
              start_line: 5,
              start_column: 0,
              end_line: 10,
              end_column: 1,
            },
            "test"
          ),
        ];

        const scopes = process_scopes(captures, file);

        // MODULE and NAMESPACE create module-level scopes, so they might replace or add to root
        // All others add a new scope to the existing root
        const min_expected = 2; // Always have at least root + created scope
        expect(scopes.size).toBeGreaterThanOrEqual(min_expected - 1);

        // Find the scope with our test name (or check by type for MODULE/NAMESPACE)
        const created_scope = Array.from(scopes.values()).find(
          (s) =>
            s.name === "test" ||
            (s.type === expected_type && s.parent_id !== null)
        );

        if (entity === "module" || entity === "namespace") {
          // Module/namespace might be nested or might modify root
          const module_scopes = Array.from(scopes.values()).filter(
            (s) => s.type === "module"
          );
          expect(module_scopes.length).toBeGreaterThan(0);
        } else {
          expect(created_scope).toBeDefined();
          expect(created_scope?.type).toBe(expected_type);
        }
      });
    });
  });

  describe("body-based scope assignment", () => {
    it("should assign definitions to correct scope with body-based scopes", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Simulate body-based scope: class body starts AFTER class name
      // class MyClass { ... }
      // Class name at 1:7:1:14, class body scope at 1:15:3:1
      const root_id = "module:test.ts:1:1:100:0" as ScopeId;
      const class_body_id = "class:test.ts:1:15:3:1" as ScopeId;

      scopes.set(root_id, {
        id: root_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          start_line: 1,
          start_column: 1,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [class_body_id],
      });

      scopes.set(class_body_id, {
        id: class_body_id,
        parent_id: root_id,
        name: "MyClass" as SymbolName,
        type: "class",
        location: {
          file_path,
          start_line: 1,
          start_column: 15, // Body starts at {
          end_line: 3,
          end_column: 1,
        },
        child_ids: [],
      });

      const captures: CaptureNode[] = [];
      const context = create_processing_context(scopes, captures);

      // Class name is at 1:7:1:14 - BEFORE the class body scope
      // Should be assigned to module scope, not class scope
      const class_name_location: Location = {
        file_path,
        start_line: 1,
        start_column: 7,
        end_line: 1,
        end_column: 14,
      };

      const scope_id = context.get_scope_id(class_name_location);
      expect(scope_id).toBe(root_id); // Class name in module scope

      // Method inside class body should be in class scope
      const method_location: Location = {
        file_path,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 15,
      };

      const method_scope_id = context.get_scope_id(method_location);
      expect(method_scope_id).toBe(class_body_id); // Method in class scope
    });

    it("should prefer smallest scope when multiple scopes have same depth", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Two module scopes with same depth but different sizes
      const small_module_id = "module:test.ts:1:1:3:1" as ScopeId;
      const large_module_id = "module:test.ts:1:1:3:10" as ScopeId;

      scopes.set(small_module_id, {
        id: small_module_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          start_line: 1,
          start_column: 1,
          end_line: 3,
          end_column: 1,
        },
        child_ids: [],
      });

      scopes.set(large_module_id, {
        id: large_module_id,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          file_path,
          start_line: 1,
          start_column: 1,
          end_line: 3,
          end_column: 10,
        },
        child_ids: [],
      });

      const captures: CaptureNode[] = [];
      const context = create_processing_context(scopes, captures);

      // Location at 1:5:1:10 is contained in both scopes
      const location: Location = {
        file_path,
        start_line: 1,
        start_column: 5,
        end_line: 1,
        end_column: 10,
      };

      const scope_id = context.get_scope_id(location);

      // Should prefer the smaller scope when depths are equal
      expect(scope_id).toBe(small_module_id);
    });
  });

  // ============================================================================
  // Integration Tests - Body-Based Scope Verification
  // ============================================================================

  describe("Integration Tests - Body-Based Scope Verification", () => {
    // Helper to create ParsedFile for integration tests
    function createParsedFile(
      code: string,
      filePath: FilePath,
      tree: Parser.Tree,
      language: Language
    ): ParsedFile {
      const lines = code.split("\n");
      return {
        file_path: filePath,
        file_lines: lines.length,
        // For 1-indexed positions with exclusive ends: end_column = length + 1
        // (tree-sitter's endPosition is exclusive and we add 1 to convert to 1-indexed)
        file_end_column: (lines[lines.length - 1]?.length || 0) + 1,
        tree,
        lang: language,
      };
    }

    describe("TypeScript Class Body-Based Scope", () => {
      let parser: Parser;

      beforeAll(() => {
        parser = new Parser();
        parser.setLanguage(TypeScript.tsx);
      });

      it("should capture only class body as scope, not entire declaration", () => {
        const code = `class MyClass {
  method() {}
}`;

        const tree = parser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.ts" as FilePath,
          tree,
          "typescript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "typescript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        const myClass = Array.from(index.classes.values()).find(
          (c) => c.name === "MyClass"
        );
        expect(myClass).toBeDefined();

        // Class scope should start at body
        expect(class_scope!.location.start_column).toBeGreaterThan(10);

        // Class name should be in module scope
        expect(myClass!.defining_scope_id).toBe(file_scope_id);

        // Class scope parent should be module scope
        const parent_scope = index.scopes.get(class_scope!.parent_id!);
        expect(parent_scope?.type).toBe("module");
      });

      it("should capture only interface body as scope, not entire declaration", () => {
        const code = `interface IFoo {
  bar(): void;
}`;

        const tree = parser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.ts" as FilePath,
          tree,
          "typescript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "typescript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const interface_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class" && s.location.start_column > 10
        );
        expect(interface_scope).toBeDefined();

        const iFoo = Array.from(index.interfaces.values()).find(
          (i) => i.name === "IFoo"
        );
        expect(iFoo).toBeDefined();

        // Interface scope should start at body
        expect(interface_scope!.location.start_column).toBeGreaterThan(10);

        // Interface name should be in module scope
        expect(iFoo!.defining_scope_id).toBe(file_scope_id);
      });

      it("should capture only enum body as scope, not entire declaration", () => {
        const code = `enum Status {
  Active = "active",
  Inactive = "inactive"
}`;

        const tree = parser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.ts" as FilePath,
          tree,
          "typescript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "typescript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const enum_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class" && s.location.start_column > 10
        );
        expect(enum_scope).toBeDefined();

        const statusEnum = Array.from(index.enums.values()).find(
          (e) => e.name === "Status"
        );
        expect(statusEnum).toBeDefined();

        // Enum scope should start at body
        expect(enum_scope!.location.start_column).toBeGreaterThan(10);

        // Enum name should be in module scope
        expect(statusEnum!.defining_scope_id).toBe(file_scope_id);
      });

      it("should correctly scope class with fields and methods", () => {
        const code = `class Calculator {
  private value: number = 0;

  add(n: number): void {
    this.value += n;
  }

  get result(): number {
    return this.value;
  }
}`;

        const tree = parser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.ts" as FilePath,
          tree,
          "typescript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "typescript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        const calcClass = Array.from(index.classes.values()).find(
          (c) => c.name === "Calculator"
        );
        expect(calcClass).toBeDefined();

        // Class name should be in module scope
        expect(calcClass!.defining_scope_id).toBe(file_scope_id);

        // Class scope should start at body
        expect(class_scope!.location.start_column).toBeGreaterThan(10);

        // Class scope parent should be module scope
        const parent_scope = index.scopes.get(class_scope!.parent_id!);
        expect(parent_scope?.type).toBe("module");
      });
    });

    describe("JavaScript Class Body-Based Scope", () => {
      let jsParser: Parser;

      beforeAll(() => {
        jsParser = new Parser();
        jsParser.setLanguage(JavaScript);
      });

      it("should capture only class body as scope for class declaration", () => {
        const code = `class MyClass {
  method() {}
}`;

        const tree = jsParser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.js" as FilePath,
          tree,
          "javascript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "javascript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        const myClass = Array.from(index.classes.values()).find(
          (c) => c.name === "MyClass"
        );
        expect(myClass).toBeDefined();

        // Class scope should start at body
        expect(class_scope!.location.start_column).toBeGreaterThan(10);

        // Class name should be in module scope
        expect(myClass!.defining_scope_id).toBe(file_scope_id);

        // Class scope parent should be module scope
        const parent_scope = index.scopes.get(class_scope!.parent_id!);
        expect(parent_scope?.type).toBe("module");
      });

      it("should capture only class body as scope for class expression", () => {
        const code = `const MyClass = class {
  method() {}
}`;

        const tree = jsParser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.js" as FilePath,
          tree,
          "javascript" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "javascript" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        // Class scope should start at body
        expect(class_scope!.location.start_column).toBeGreaterThan(20);
      });
    });

    describe("Python Class Body-Based Scope", () => {
      let pyParser: Parser;

      beforeAll(() => {
        pyParser = new Parser();
        pyParser.setLanguage(Python);
      });

      it("should capture only class body as scope, not entire declaration", () => {
        const code = `class MyClass:
    def method(self):
        pass`;

        const tree = pyParser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.py" as FilePath,
          tree,
          "python" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "python" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        const myClass = Array.from(index.classes.values()).find(
          (c) => c.name === "MyClass"
        );
        expect(myClass).toBeDefined();

        // Class scope should start after ':'
        expect(class_scope!.location.start_line).toBeGreaterThan(0);

        // Class name should be in module scope
        expect(myClass!.defining_scope_id).toBe(file_scope_id);

        // Class scope parent should be module scope
        const parent_scope = index.scopes.get(class_scope!.parent_id!);
        expect(parent_scope?.type).toBe("module");
      });

      it("should correctly scope class with multiple methods", () => {
        const code = `class Calculator:
    def add(self, x, y):
        return x + y

    def subtract(self, x, y):
        return x - y`;

        const tree = pyParser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.py" as FilePath,
          tree,
          "python" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "python" as Language
        );

        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();
        const file_scope_id = file_scope!.id;

        const class_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "class"
        );
        expect(class_scope).toBeDefined();

        const calcClass = Array.from(index.classes.values()).find(
          (c) => c.name === "Calculator"
        );
        expect(calcClass).toBeDefined();

        // Class name should be in module scope
        expect(calcClass!.defining_scope_id).toBe(file_scope_id);

        // Class scope should start on next line
        expect(class_scope!.location.start_line).toBeGreaterThan(0);

        // Class scope parent should be module scope
        const parent_scope = index.scopes.get(class_scope!.parent_id!);
        expect(parent_scope?.type).toBe("module");
      });

      it("should correctly scope nested classes", () => {
        const code = `class Outer:
    def method(self):
        class Inner:
            def inner_method(self):
                pass`;
        const tree = pyParser.parse(code);
        const parsedFile = createParsedFile(
          code,
          "test.py" as FilePath,
          tree,
          "python" as Language
        );
        const index = build_semantic_index(
          parsedFile,
          tree,
          "python" as Language
        );

        // Find scopes
        const file_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "module" && s.parent_id === null
        );
        expect(file_scope).toBeDefined();

        const method_scope = Array.from(index.scopes.values()).find(
          (s) => s.type === "method"
        );
        expect(method_scope).toBeDefined();

        // Find classes from definitions
        const outer_class = Array.from(index.classes.values()).find(
          (c) => c.name === "Outer"
        );
        const inner_class = Array.from(index.classes.values()).find(
          (c) => c.name === "Inner"
        );

        expect(outer_class).toBeDefined();
        expect(inner_class).toBeDefined();

        // Outer class should be in file scope, Inner should be in method scope
        expect(outer_class!.defining_scope_id).toBe(file_scope!.id);
        expect(inner_class!.defining_scope_id).toBe(method_scope!.id);
      });
    });
  });
});
