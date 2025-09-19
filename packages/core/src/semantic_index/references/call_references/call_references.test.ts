/**
 * Comprehensive tests for call references processing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
  LexicalScope,
  Location,
  TypeId,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import {
  CallReference,
  CallGraphNode,
  process_call_references,
  resolve_method_calls,
  build_call_graph,
} from "./call_references";

// Mock dependencies
vi.mock("../../../ast/node_utils", () => ({
  node_to_location: vi.fn((node, file_path) => ({
    file_path,
    line: node.start_line || 1,
    column: node.start_column || 0,
    end_line: node.end_line || 1,
    end_column: node.end_column || 10,
  })),
}));

vi.mock("../../scope_tree", () => ({
  find_containing_scope: vi.fn(),
}));

import { node_to_location } from "../../../ast/node_utils";
import { find_containing_scope } from "../../scope_tree";

const mockNodeToLocation = vi.mocked(node_to_location);
const mockFindContainingScope = vi.mocked(find_containing_scope);

describe("Call References", () => {
  const mockFilePath = "test.ts" as FilePath;
  const mockLocation: Location = {
    file_path: mockFilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  const mockScope: LexicalScope = {
    id: "scope_1" as ScopeId,
    parent_id: null,
    name: "testFunction" as SymbolName,
    type: "function",
    location: {
      file_path: mockFilePath,
      line: 1,
      column: 0,
      end_line: 10,
      end_column: 0,
    },
    child_ids: [],
    symbols: new Map(),
  };

  const mockScopes = new Map<ScopeId, LexicalScope>([
    [mockScope.id, mockScope],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
    mockNodeToLocation.mockReturnValue(mockLocation);
  });

  describe("CallReference Interface", () => {
    it("should define correct structure for function calls", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "testFunction" as SymbolName,
        scope_id: mockScope.id,
        call_type: "function",
      };

      expect(callRef.location).toEqual(mockLocation);
      expect(callRef.name).toBe("testFunction" as SymbolName);
      expect(callRef.call_type).toBe("function");
      expect(callRef.scope_id).toBe(mockScope.id);
    });

    it("should define correct structure for method calls", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "methodName" as SymbolName,
        scope_id: mockScope.id,
        call_type: "method",
        receiver: {
          type: { type_name: "MyClass" as SymbolName },
          location: mockLocation,
        },
        is_static_call: false,
      };

      expect(callRef.call_type).toBe("method");
      expect(callRef.receiver).toBeDefined();
      expect(callRef.receiver?.type?.type_name).toBe("MyClass" as SymbolName);
      expect(callRef.is_static_call).toBe(false);
    });

    it("should define correct structure for constructor calls", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "MyClass" as SymbolName,
        scope_id: mockScope.id,
        call_type: "constructor",
        construct_target: mockLocation,
      };

      expect(callRef.call_type).toBe("constructor");
      expect(callRef.construct_target).toEqual(mockLocation);
    });

    it("should define correct structure for super calls", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "super" as SymbolName,
        scope_id: mockScope.id,
        call_type: "super",
        super_class: "ParentClass" as SymbolName,
        containing_function: "derived_method" as SymbolId,
      };

      expect(callRef.call_type).toBe("super");
      expect(callRef.super_class).toBe("ParentClass" as SymbolName);
      expect(callRef.containing_function).toBe("derived_method");
    });

    it("should support optional resolved properties", () => {
      const callRef: CallReference = {
        location: mockLocation,
        name: "testFunction" as SymbolName,
        scope_id: mockScope.id,
        call_type: "function",
        resolved_symbol: "resolved_func" as SymbolId,
        resolved_return_type: "string_type" as TypeId,
      };

      expect(callRef.resolved_symbol).toBe("resolved_func");
      expect(callRef.resolved_return_type).toBe("string_type");
    });
  });

  describe("process_call_references", () => {
    describe("Success Cases", () => {
      it("should process function call captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "testFunction",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("testFunction" as SymbolName);
        expect(result[0].call_type).toBe("function");
        expect(result[0].location).toEqual(mockLocation);
        expect(result[0].scope_id).toBe(mockScope.id);
      });

      it("should process method call captures with receiver", () => {
        const mockReceiver = {
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 5,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "methodName",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: mockReceiver,
            },
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].call_type).toBe("method");
        expect(result[0].receiver).toBeDefined();
        expect(result[0].receiver?.location).toEqual(mockLocation);
      });

      it("should process constructor call captures", () => {
        const mockTarget = {
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 10,
        };

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "MyClass",
            node_location: mockLocation,
            modifiers: {},
            context: {
              construct_target: mockTarget,
            },
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].call_type).toBe("constructor");
        expect(result[0].construct_target).toEqual(mockLocation);
      });

      it("should process super call captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.SUPER,
            text: "super",
            node_location: mockLocation,
            modifiers: {},
            context: {
              extends_class: "ParentClass",
            },
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].call_type).toBe("super");
        expect(result[0].super_class).toBe("ParentClass" as SymbolName);
      });

      it("should include containing function for nested calls", () => {
        const functionScope: LexicalScope = {
          id: "func_scope" as ScopeId,
          parent_id: null,
          name: null,
          type: "function",
          location: {
            file_path: mockFilePath,
            line: 1,
            column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
          symbols: new Map(),
        };

        const scopeToSymbol = new Map<ScopeId, SymbolId>([
          [functionScope.id, "containing_func" as SymbolId],
        ]);

        mockFindContainingScope.mockReturnValue(functionScope);

        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "nestedFunction",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath,
          scopeToSymbol
        );

        expect(result).toHaveLength(1);
        expect(result[0].containing_function).toBe("containing_func");
      });

      it("should handle multiple call types in same capture set", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "func",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "method",
            node_location: mockLocation,
            modifiers: {},
            context: { receiver_node: {} },
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.SUPER,
            text: "super",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(3);
        expect(result[0].call_type).toBe("function");
        expect(result[1].call_type).toBe("method");
        expect(result[2].call_type).toBe("super");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty captures array", () => {
        const result = process_call_references(
          [],
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toEqual([]);
      });

      it("should filter out non-call captures", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.DEFINITION,
            entity: SemanticEntity.FUNCTION,
            text: "defined_function",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "called_function",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("called_function");
      });

      it("should handle captures without context", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "simpleCall",
            node_location: mockLocation,
            modifiers: {},
            context: undefined,
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].call_type).toBe("function");
        expect(result[0].receiver).toBeUndefined();
      });

      it("should handle missing scope mapping", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "orphanCall",
            node_location: mockLocation,
            modifiers: {},
            context: {},
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].containing_function).toBeUndefined();
      });

      it("should handle malformed contexts gracefully", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.REFERENCE,
            entity: SemanticEntity.CALL,
            text: "malformedCall",
            node_location: mockLocation,
            modifiers: {},
            context: {
              receiver_node: null,
              construct_target: undefined,
            },
          },
        ];

        const result = process_call_references(
          captures,
          mockScope,
          mockScopes,
          mockFilePath
        );

        expect(result).toHaveLength(1);
        expect(result[0].call_type).toBe("function");
      });
    });
  });

  describe("resolve_method_calls", () => {
    describe("Success Cases", () => {
      it("should resolve method calls with known receiver types", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "getValue" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: {
              type: { type_name: "MyClass" as SymbolName },
            },
          },
        ];

        const symbols = new Map([
          [
            "class_symbol" as SymbolId,
            {
              kind: "class",
              name: "MyClass",
              methods: ["method_symbol" as SymbolId],
            },
          ],
          [
            "method_symbol" as SymbolId,
            {
              kind: "method",
              name: "getValue",
            },
          ],
        ]);

        const resolutions = resolve_method_calls(calls, symbols);

        expect(resolutions.size).toBe(1);
        expect(resolutions.get(mockLocation)).toBe("method_symbol");
        expect(calls[0].resolved_symbol).toBe("method_symbol");
      });

      it("should handle multiple method resolutions", () => {
        const location2: Location = {
          file_path: mockFilePath,
          line: 2,
          column: 0,
          end_line: 2,
          end_column: 10,
        };

        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "getValue" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: { type: { type_name: "MyClass" } },
          },
          {
            location: location2,
            name: "setValue" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: { type: { type_name: "MyClass" } },
          },
        ];

        const symbols = new Map([
          [
            "class_symbol" as SymbolId,
            {
              kind: "class",
              name: "MyClass",
              methods: ["getValue_method" as SymbolId, "setValue_method" as SymbolId],
            },
          ],
          ["getValue_method" as SymbolId, { kind: "method", name: "getValue" }],
          ["setValue_method" as SymbolId, { kind: "method", name: "setValue" }],
        ]);

        const resolutions = resolve_method_calls(calls, symbols);

        expect(resolutions.size).toBe(2);
        expect(resolutions.get(mockLocation)).toBe("getValue_method");
        expect(resolutions.get(location2)).toBe("setValue_method");
      });

      it("should resolve inherited methods", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "parentMethod" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: { type: { type_name: "ChildClass" } },
          },
        ];

        const symbols = new Map([
          [
            "parent_class" as SymbolId,
            {
              kind: "class",
              name: "ParentClass",
              methods: ["parent_method" as SymbolId],
            },
          ],
          [
            "child_class" as SymbolId,
            {
              kind: "class",
              name: "ChildClass",
              methods: ["parent_method" as SymbolId],
            },
          ],
          [
            "parent_method" as SymbolId,
            { kind: "method", name: "parentMethod" },
          ],
        ]);

        const resolutions = resolve_method_calls(calls, symbols);

        expect(resolutions.size).toBe(1);
        expect(resolutions.get(mockLocation)).toBe("parent_method");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty calls array", () => {
        const resolutions = resolve_method_calls([], new Map());
        expect(resolutions.size).toBe(0);
      });

      it("should skip non-method calls", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "functionCall" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
          },
          {
            location: mockLocation,
            name: "ConstructorCall" as SymbolName,
            scope_id: mockScope.id,
            call_type: "constructor",
          },
        ];

        const resolutions = resolve_method_calls(calls, new Map());
        expect(resolutions.size).toBe(0);
      });

      it("should handle method calls without receiver type", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "unknownMethod" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: {},
          },
        ];

        const resolutions = resolve_method_calls(calls, new Map());
        expect(resolutions.size).toBe(0);
      });

      it("should handle unresolvable method calls", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "missingMethod" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: { type: { type_name: "UnknownClass" } },
          },
        ];

        const symbols = new Map([
          [
            "known_class" as SymbolId,
            {
              kind: "class",
              name: "KnownClass",
              methods: ["known_method" as SymbolId],
            },
          ],
        ]);

        const resolutions = resolve_method_calls(calls, symbols);
        expect(resolutions.size).toBe(0);
      });

      it("should handle class without matching method", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "nonExistentMethod" as SymbolName,
            scope_id: mockScope.id,
            call_type: "method",
            receiver: { type: { type_name: "MyClass" } },
          },
        ];

        const symbols = new Map([
          [
            "class_symbol" as SymbolId,
            {
              kind: "class",
              name: "MyClass",
              methods: ["other_method" as SymbolId],
            },
          ],
          ["other_method" as SymbolId, { kind: "method", name: "otherMethod" }],
        ]);

        const resolutions = resolve_method_calls(calls, symbols);
        expect(resolutions.size).toBe(0);
      });
    });
  });

  describe("CallGraphNode Interface", () => {
    it("should define correct structure", () => {
      const node: CallGraphNode = {
        symbol: "test_symbol" as SymbolId,
        calls_to: new Set(["target1" as SymbolId, "target2" as SymbolId]),
        called_by: new Set(["caller1" as SymbolId]),
        call_sites: [],
      };

      expect(node.symbol).toBe("test_symbol");
      expect(node.calls_to.size).toBe(2);
      expect(node.called_by.size).toBe(1);
      expect(Array.isArray(node.call_sites)).toBe(true);
    });
  });

  describe("build_call_graph", () => {
    describe("Success Cases", () => {
      it("should build graph from resolved calls", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "targetFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "caller" as SymbolId,
            resolved_symbol: "target" as SymbolId,
          },
        ];

        const graph = build_call_graph(calls);

        expect(graph.size).toBe(2);
        expect(graph.has("caller" as SymbolId)).toBe(true);
        expect(graph.has("target" as SymbolId)).toBe(true);

        const caller = graph.get("caller" as SymbolId)!;
        const target = graph.get("target" as SymbolId)!;

        expect(caller.calls_to.has("target" as SymbolId)).toBe(true);
        expect(target.called_by.has("caller" as SymbolId)).toBe(true);
        expect(caller.call_sites).toHaveLength(1);
      });

      it("should handle multiple calls between same functions", () => {
        const location2: Location = {
          file_path: mockFilePath,
          line: 2,
          column: 0,
          end_line: 2,
          end_column: 10,
        };

        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "targetFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "caller" as SymbolId,
            resolved_symbol: "target" as SymbolId,
          },
          {
            location: location2,
            name: "targetFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "caller" as SymbolId,
            resolved_symbol: "target" as SymbolId,
          },
        ];

        const graph = build_call_graph(calls);

        expect(graph.size).toBe(2);
        const caller = graph.get("caller" as SymbolId)!;
        expect(caller.call_sites).toHaveLength(2);
        expect(caller.calls_to.size).toBe(1);
      });

      it("should handle complex call relationships", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "b" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "a" as SymbolId,
            resolved_symbol: "b" as SymbolId,
          },
          {
            location: mockLocation,
            name: "c" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "b" as SymbolId,
            resolved_symbol: "c" as SymbolId,
          },
          {
            location: mockLocation,
            name: "a" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "c" as SymbolId,
            resolved_symbol: "a" as SymbolId,
          },
        ];

        const graph = build_call_graph(calls);

        expect(graph.size).toBe(3);

        // Check that all nodes have correct relationships
        const nodeA = graph.get("a" as SymbolId)!;
        const nodeB = graph.get("b" as SymbolId)!;
        const nodeC = graph.get("c" as SymbolId)!;

        expect(nodeA.calls_to.has("b" as SymbolId)).toBe(true);
        expect(nodeB.calls_to.has("c" as SymbolId)).toBe(true);
        expect(nodeC.calls_to.has("a" as SymbolId)).toBe(true);

        expect(nodeA.called_by.has("c" as SymbolId)).toBe(true);
        expect(nodeB.called_by.has("a" as SymbolId)).toBe(true);
        expect(nodeC.called_by.has("b" as SymbolId)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty calls array", () => {
        const graph = build_call_graph([]);
        expect(graph.size).toBe(0);
      });

      it("should skip calls without resolved symbols", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "unresolvedFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "caller" as SymbolId,
            // No resolved_symbol
          },
        ];

        const graph = build_call_graph(calls);
        expect(graph.size).toBe(0);
      });

      it("should skip calls without containing function", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "orphanFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            resolved_symbol: "target" as SymbolId,
            // No containing_function
          },
        ];

        const graph = build_call_graph(calls);
        expect(graph.size).toBe(0);
      });

      it("should handle self-referential calls", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "recursiveFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "recursive" as SymbolId,
            resolved_symbol: "recursive" as SymbolId,
          },
        ];

        const graph = build_call_graph(calls);

        expect(graph.size).toBe(1);
        const node = graph.get("recursive" as SymbolId)!;
        expect(node.calls_to.has("recursive" as SymbolId)).toBe(true);
        expect(node.called_by.has("recursive" as SymbolId)).toBe(true);
        expect(node.call_sites).toHaveLength(1);
      });

      it("should initialize nodes with correct defaults", () => {
        const calls: CallReference[] = [
          {
            location: mockLocation,
            name: "newFunc" as SymbolName,
            scope_id: mockScope.id,
            call_type: "function",
            containing_function: "newCaller" as SymbolId,
            resolved_symbol: "newTarget" as SymbolId,
          },
        ];

        const graph = build_call_graph(calls);

        const caller = graph.get("newCaller" as SymbolId)!;
        const target = graph.get("newTarget" as SymbolId)!;

        expect(caller.symbol).toBe("newCaller");
        expect(caller.calls_to).toBeInstanceOf(Set);
        expect(caller.called_by).toBeInstanceOf(Set);
        expect(Array.isArray(caller.call_sites)).toBe(true);

        expect(target.symbol).toBe("newTarget");
        expect(target.calls_to).toBeInstanceOf(Set);
        expect(target.called_by).toBeInstanceOf(Set);
        expect(Array.isArray(target.call_sites)).toBe(true);
      });
    });
  });

  describe("Integration Tests", () => {
    it("should process complete call reference pipeline", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "processData",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const functionScope: LexicalScope = {
        id: "func_scope" as ScopeId,
        parent_id: null,
        name: null,
        type: "method",
        location: {
          file_path: mockFilePath,
          line: 1,
          column: 0,
          end_line: 10,
          end_column: 0,
        },
        child_ids: [],
        symbols: new Map(),
      };

      const scopeToSymbol = new Map<ScopeId, SymbolId>([
        [functionScope.id, "containing_method" as SymbolId],
      ]);

      mockFindContainingScope.mockReturnValue(functionScope);

      // Process call references
      const calls = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath,
        scopeToSymbol
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].containing_function).toBe("containing_method");

      // Manually resolve for testing
      calls[0].resolved_symbol = "processData_func" as SymbolId;

      // Build call graph
      const graph = build_call_graph(calls);

      expect(graph.size).toBe(2);
      expect(graph.has("containing_method" as SymbolId)).toBe(true);
      expect(graph.has("processData_func" as SymbolId)).toBe(true);
    });

    it("should handle mixed call types in pipeline", () => {
      const mockReceiver = { start_line: 1, start_column: 0 };

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "regularFunc",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "methodCall",
          node_location: mockLocation,
          modifiers: {},
          context: { receiver_node: mockReceiver },
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.SUPER,
          text: "super",
          node_location: mockLocation,
          modifiers: {},
          context: { extends_class: "Parent" },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(calls).toHaveLength(3);
      expect(calls.map(c => c.call_type)).toEqual(["function", "method", "super"]);

      // Test resolution with symbols
      const symbols = new Map([
        [
          "class_symbol" as SymbolId,
          {
            kind: "class",
            name: "TestClass",
            methods: ["methodCall_symbol" as SymbolId],
          },
        ],
        ["methodCall_symbol" as SymbolId, { kind: "method", name: "methodCall" }],
      ]);

      // Set receiver type for method call
      calls[1].receiver = { type: { type_name: "TestClass" } };

      const resolutions = resolve_method_calls(calls, symbols);
      expect(resolutions.size).toBe(1);
      expect(calls[1].resolved_symbol).toBe("methodCall_symbol");
    });
  });
});