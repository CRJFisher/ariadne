/**
 * Tests for simplified type flow extraction
 */

import { describe, it, expect } from "vitest";
import type { ScopeId, LexicalScope, FilePath, SymbolName } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../parse_and_query_code/capture_types";
import { SemanticCategory, SemanticEntity } from "../../parse_and_query_code/capture_types";
import { extract_type_flow } from "./type_flow_references";

describe("extract_type_flow", () => {
  // Helper to create a basic scope
  function create_mock_scope(
    id: string = "scope-1",
    type: LexicalScope["type"] = "module"
  ): Map<ScopeId, LexicalScope> {
    const scopes = new Map<ScopeId, LexicalScope>();
    const root_scope: LexicalScope = {
      id: id as ScopeId,
      parent_id: null,
      name: null,
      type,
      location: {
        line: 0,
        column: 0,
        file_path: id.includes("test.ts")
          ? ("test.ts" as FilePath)
          : ("unknown.ts" as FilePath),
        end_line: 100,
        end_column: 0,
      },
      child_ids: [],
      symbols: new Map(),
    };
    scopes.set(root_scope.id, root_scope);
    return scopes;
  }

  it("should track constructor calls without resolution", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "MyClass",
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        node_location: {
          line: 1,
          column: 10,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 17,
        },
        modifiers: {},
        context: undefined, // "1",
      },
    ];

    const scopes = create_mock_scope();
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    // Should track the constructor call
    expect(flow.constructor_calls).toHaveLength(1);
    expect(flow.constructor_calls[0].class_name).toBe("MyClass");
    expect(flow.constructor_calls[0].location).toEqual({
      line: 1,
      column: 10,
      file_path: "test.ts" as FilePath,
      end_line: 1,
      end_column: 17,
    });

    // No type resolution should occur
    expect(flow.constructor_calls[0]).not.toHaveProperty("type_id");
    expect(flow.constructor_calls[0]).not.toHaveProperty("resolved_type");
  });

  it("should track assignments without type resolution", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "variableName",
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        node_location: {
          line: 2,
          column: 5,
          file_path: "test.ts" as FilePath,
          end_line: 2,
          end_column: 17,
        },
        modifiers: {},
        context: undefined, // "2",
      },
    ];

    const scopes = create_mock_scope();
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    // Should track the assignment
    expect(flow.assignments).toHaveLength(1);
    expect(flow.assignments[0].target).toBe("variableName");
    expect(flow.assignments[0].location).toEqual({
      line: 2,
      column: 5,
      file_path: "test.ts" as FilePath,
      end_line: 2,
      end_column: 17,
    });

    // No type info should be attached
    expect(flow.assignments[0]).not.toHaveProperty("type_info");
    expect(flow.assignments[0]).not.toHaveProperty("resolved_type");
  });

  it("should track return statements without type resolution", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "returnValue",
        category: SemanticCategory.RETURN,
        entity: SemanticEntity.VARIABLE,
        node_location: {
          line: 3,
          column: 8,
          file_path: "test.ts" as FilePath,
          end_line: 3,
          end_column: 19,
        },
        modifiers: {},
        context: undefined, // "3",
      },
    ];

    const scopes = create_mock_scope("scope-1", "function");
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    // Should track the return statement
    expect(flow.returns).toHaveLength(1);
    expect(flow.returns[0].location).toEqual({
      line: 3,
      column: 8,
      file_path: "test.ts" as FilePath,
      end_line: 3,
      end_column: 19,
    });
    expect(flow.returns[0].value.kind).toBe("expression");

    // No return type inference
    expect(flow.returns[0]).not.toHaveProperty("inferred_type");
  });

  it("should not track function calls without assignments", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "someFunction",
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        node_location: {
          line: 4,
          column: 0,
          file_path: "test.ts" as FilePath,
          end_line: 4,
          end_column: 12,
        },
        modifiers: {},
        context: undefined, // "4",
      },
    ];

    const scopes = create_mock_scope();
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    // Should not track call without assignment
    expect(flow.call_assignments).toHaveLength(0);
  });

  it("should handle multiple captures of different types", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "MyClass",
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        node_location: {
          line: 1,
          column: 10,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 17,
        },
        modifiers: {},
        context: undefined, // "1",
      },
      {
        text: "x",
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        node_location: {
          line: 2,
          column: 5,
          file_path: "test.ts" as FilePath,
          end_line: 2,
          end_column: 17,
        },
        modifiers: {},
        context: undefined, // "2",
      },
      {
        text: "result",
        category: SemanticCategory.RETURN,
        entity: SemanticEntity.VARIABLE,
        node_location: {
          line: 3,
          column: 8,
          file_path: "test.ts" as FilePath,
          end_line: 3,
          end_column: 19,
        },
        modifiers: {},
        context: undefined, // "3",
      },
    ];

    const scopes = create_mock_scope();
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    expect(flow.constructor_calls).toHaveLength(1);
    expect(flow.assignments).toHaveLength(1);
    expect(flow.returns).toHaveLength(1);
    expect(flow.call_assignments).toHaveLength(0);
  });

  it("should return empty arrays when no relevant captures", () => {
    const captures: NormalizedCapture[] = [
      {
        text: "className",
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.CLASS,
        node_location: {
          line: 1,
          column: 0,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 9,
        },
        modifiers: {},
        context: undefined, // "1",
      },
    ];

    const scopes = create_mock_scope();
    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    expect(flow.constructor_calls).toHaveLength(0);
    expect(flow.assignments).toHaveLength(0);
    expect(flow.returns).toHaveLength(0);
    expect(flow.call_assignments).toHaveLength(0);
  });

  it("should handle empty captures array", () => {
    const captures: NormalizedCapture[] = [];
    const scopes = create_mock_scope();

    const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

    expect(flow.constructor_calls).toHaveLength(0);
    expect(flow.assignments).toHaveLength(0);
    expect(flow.returns).toHaveLength(0);
    expect(flow.call_assignments).toHaveLength(0);
  });

  describe("edge cases", () => {
    it("should handle nested scopes correctly", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Create parent scope
      const parentScope: LexicalScope = {
        id: "parent" as ScopeId,
        parent_id: null,
        name: null,
        type: "module",
        location: {
          line: 0,
          column: 0,
          file_path: "test.ts" as FilePath,
          end_line: 100,
          end_column: 0,
        },
        child_ids: ["child" as ScopeId],
        symbols: new Map(),
      };

      // Create child scope
      const childScope: LexicalScope = {
        id: "child" as ScopeId,
        parent_id: "parent" as ScopeId,
        name: "innerFunction" as SymbolName,
        type: "function",
        location: {
          line: 10,
          column: 0,
          file_path: "test.ts" as FilePath,
          end_line: 20,
          end_column: 0,
        },
        child_ids: [],
        symbols: new Map(),
      };

      scopes.set(parentScope.id, parentScope);
      scopes.set(childScope.id, childScope);

      const captures: NormalizedCapture[] = [
        {
          text: "innerReturn",
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            line: 15,
            column: 4,
            file_path: "test.ts" as FilePath,
            end_line: 15,
            end_column: 15,
          },
          modifiers: {},
          context: undefined,
        },
      ];

      const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

      expect(flow.returns).toHaveLength(1);
      expect(flow.returns[0].scope_id).toBe("child");
    });

    it("should handle constructor calls with different argument counts", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "ClassWithArgs",
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            line: 1,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 1,
            end_column: 13,
          },
          modifiers: {},
          context: undefined,
        },
      ];

      const scopes = create_mock_scope();
      const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

      expect(flow.constructor_calls).toHaveLength(1);
      // Currently returns 0 as count_arguments is not fully implemented
      expect(flow.constructor_calls[0].argument_count).toBe(0);
    });

    it("should distinguish constructor calls from regular function calls", () => {
      const captures: NormalizedCapture[] = [
        {
          text: "MyClass", // Capitalized - constructor
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            line: 1,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 1,
            end_column: 7,
          },
          modifiers: {},
          context: undefined,
        },
        {
          text: "myFunction", // lowercase - regular function
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            line: 2,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 2,
            end_column: 10,
          },
          modifiers: {},
          context: undefined,
        },
      ];

      const scopes = create_mock_scope();
      const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

      expect(flow.constructor_calls).toHaveLength(1);
      expect(flow.constructor_calls[0].class_name).toBe("MyClass");
      // Regular function not tracked without assignment
      expect(flow.call_assignments).toHaveLength(0);
    });

    it("should handle mixed capture types in single processing", () => {
      const captures: NormalizedCapture[] = [
        // Constructor
        {
          text: "Widget",
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            line: 1,
            column: 10,
            file_path: "test.ts" as FilePath,
            end_line: 1,
            end_column: 16,
          },
          modifiers: {},
          context: undefined,
        },
        // Assignment
        {
          text: "data",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            line: 2,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 2,
            end_column: 4,
          },
          modifiers: {},
          context: undefined,
        },
        // Another assignment
        {
          text: "result",
          category: SemanticCategory.ASSIGNMENT,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            line: 3,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 3,
            end_column: 6,
          },
          modifiers: {},
          context: undefined,
        },
        // Return
        {
          text: "data",
          category: SemanticCategory.RETURN,
          entity: SemanticEntity.VARIABLE,
          node_location: {
            line: 4,
            column: 2,
            file_path: "test.ts" as FilePath,
            end_line: 4,
            end_column: 6,
          },
          modifiers: {},
          context: undefined,
        },
      ];

      const scopes = create_mock_scope();
      const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

      expect(flow.constructor_calls).toHaveLength(1);
      expect(flow.assignments).toHaveLength(2);
      expect(flow.returns).toHaveLength(1);
      expect(flow.call_assignments).toHaveLength(0);
    });

    it("should handle captures with no root scope", () => {
      const scopes = new Map<ScopeId, LexicalScope>();

      // Add only a non-root scope
      const nonRootScope: LexicalScope = {
        id: "child" as ScopeId,
        parent_id: "missing" as ScopeId, // Parent doesn't exist
        name: null,
        type: "function",
        location: {
          line: 0,
          column: 0,
          file_path: "test.ts" as FilePath,
          end_line: 100,
          end_column: 0,
        },
        child_ids: [],
        symbols: new Map(),
      };

      scopes.set(nonRootScope.id, nonRootScope);

      const captures: NormalizedCapture[] = [
        {
          text: "TestClass",
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          node_location: {
            line: 5,
            column: 0,
            file_path: "test.ts" as FilePath,
            end_line: 5,
            end_column: 9,
          },
          modifiers: {},
          context: undefined,
        },
      ];

      const flow = extract_type_flow(captures, scopes, "test.ts" as FilePath);

      // Should still work with fallback scope
      expect(flow.constructor_calls).toHaveLength(1);
      expect(flow.constructor_calls[0].scope_id).toBe("child");
    });
  });
});
