/**
 * Tests for bugs and edge cases discovered in call_references module
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

describe("Call References Bug Tests", () => {
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
    location: mockLocation,
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

  describe("Type Safety Issues", () => {
    it("should handle non-string capture text gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "", // Empty string
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "   ", // Whitespace only
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

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("");
      expect(result[1].name).toBe("   ");
    });

    it("should handle malformed extends_class context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.SUPER,
          text: "super",
          node_location: mockLocation,
          modifiers: {},
          context: {
            extends_class: null, // null value
          },
        },
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.SUPER,
          text: "super",
          node_location: mockLocation,
          modifiers: {},
          context: {
            extends_class: 123, // non-string value
          },
        },
      ];

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result).toHaveLength(2);
      expect(result[0].super_class).toBe(null);
      expect(result[1].super_class).toBe(123);
    });
  });

  describe("Error Handling Issues", () => {
    it("should handle node_to_location throwing errors", () => {
      mockNodeToLocation.mockImplementation(() => {
        throw new Error("Invalid node structure");
      });

      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "methodCall",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
          },
        },
      ];

      expect(() => {
        process_call_references(captures, mockScope, mockScopes, mockFilePath);
      }).toThrow("Invalid node structure");
    });

    it("should handle missing scope gracefully", () => {
      mockFindContainingScope.mockReturnValue(null as any);

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

      expect(() => {
        process_call_references(captures, mockScope, mockScopes, mockFilePath);
      }).toThrow(); // Should throw due to null scope
    });
  });

  describe("Method Resolution Issues", () => {
    it("should handle symbols with malformed methods array", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "testMethod" as SymbolName,
          scope_id: mockScope.id,
          call_type: "method",
          receiver: {
            type: { type_name: "BadClass" as SymbolName },
          },
        },
      ];

      const symbols = new Map([
        [
          "bad_class" as SymbolId,
          {
            kind: "class",
            name: "BadClass",
            methods: "not_an_array", // Wrong type
          },
        ],
      ]);

      // The current implementation uses `|| []` fallback, so it silently skips
      const resolutions = resolve_method_calls(calls, symbols);
      expect(resolutions.size).toBe(0); // No resolution due to malformed methods
      expect(calls[0].resolved_symbol).toBeUndefined();
    });

    it("should handle method resolution with missing method symbols", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "missingMethod" as SymbolName,
          scope_id: mockScope.id,
          call_type: "method",
          receiver: {
            type: { type_name: "TestClass" as SymbolName },
          },
        },
      ];

      const symbols = new Map([
        [
          "test_class" as SymbolId,
          {
            kind: "class",
            name: "TestClass",
            methods: ["missing_method_id" as SymbolId], // Method ID not in symbols map
          },
        ],
        // Note: missing_method_id is not in the symbols map
      ]);

      const resolutions = resolve_method_calls(calls, symbols);
      expect(resolutions.size).toBe(0); // Should not resolve
      expect(calls[0].resolved_symbol).toBeUndefined();
    });

    it("should demonstrate mutation side effect issue", () => {
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

      const originalCall = { ...calls[0] };

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

      // Demonstrates the problematic side effect - the input array is mutated
      expect(calls[0].resolved_symbol).toBe("method_symbol");
      expect(originalCall.resolved_symbol).toBeUndefined();
      expect(calls[0]).not.toEqual(originalCall);
    });
  });

  describe("Performance Issues", () => {
    it("should handle large symbol maps efficiently", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "targetMethod" as SymbolName,
          scope_id: mockScope.id,
          call_type: "method",
          receiver: {
            type: { type_name: "TargetClass" as SymbolName },
          },
        },
      ];

      // Create a large symbols map to test performance
      const symbols = new Map();

      // Add 1000 dummy classes
      for (let i = 0; i < 1000; i++) {
        symbols.set(`class_${i}` as SymbolId, {
          kind: "class",
          name: `Class${i}`,
          methods: [`method_${i}` as SymbolId],
        });
        symbols.set(`method_${i}` as SymbolId, {
          kind: "method",
          name: `method${i}`,
        });
      }

      // Add our target at the end
      symbols.set("target_class" as SymbolId, {
        kind: "class",
        name: "TargetClass",
        methods: ["target_method" as SymbolId],
      });
      symbols.set("target_method" as SymbolId, {
        kind: "method",
        name: "targetMethod",
      });

      const start = Date.now();
      const resolutions = resolve_method_calls(calls, symbols);
      const duration = Date.now() - start;

      expect(resolutions.size).toBe(1);
      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });

  describe("Build Call Graph Issues", () => {
    it("should handle duplicate call sites correctly", () => {
      const duplicateCall: CallReference = {
        location: mockLocation,
        name: "duplicateFunc" as SymbolName,
        scope_id: mockScope.id,
        call_type: "function",
        containing_function: "caller" as SymbolId,
        resolved_symbol: "target" as SymbolId,
      };

      const calls = [duplicateCall, duplicateCall]; // Same call twice

      const graph = build_call_graph(calls);

      expect(graph.size).toBe(2);
      const caller = graph.get("caller" as SymbolId)!;
      expect(caller.call_sites).toHaveLength(2); // Both calls should be recorded
      expect(caller.calls_to.size).toBe(1); // But only one unique target
    });

    it("should handle self-referential calls with missing resolved_symbol", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "recursiveFunc" as SymbolName,
          scope_id: mockScope.id,
          call_type: "function",
          containing_function: "recursive" as SymbolId,
          // Missing resolved_symbol
        },
      ];

      const graph = build_call_graph(calls);
      expect(graph.size).toBe(0); // Should skip calls without resolved symbols
    });
  });

  describe("Interface Consistency Issues", () => {
    it("should demonstrate readonly field mutation inconsistency", () => {
      // The CallReference interface has some readonly fields but not others
      const call: CallReference = {
        location: mockLocation,
        name: "test" as SymbolName,
        scope_id: mockScope.id,
        call_type: "function",
      };

      // These should not be allowed if the interface was consistent:
      call.resolved_symbol = "new_symbol" as SymbolId;
      call.resolved_return_type = "new_type" as TypeId;
      call.is_static_call = true;

      expect(call.resolved_symbol).toBe("new_symbol");
      expect(call.resolved_return_type).toBe("new_type");
      expect(call.is_static_call).toBe(true);
    });
  });

  describe("Missing Implementation Issues", () => {
    it("should demonstrate missing static method detection", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "staticMethod",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
            is_static: true, // This context isn't handled
          },
        },
      ];

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result[0].is_static_call).toBeUndefined(); // Not implemented
    });

    it("should demonstrate missing type inference", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "methodCall",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
            receiver_type: "SomeClass", // This context isn't used
          },
        },
      ];

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result[0].receiver?.type).toBeUndefined(); // Type inference not implemented
    });
  });
});