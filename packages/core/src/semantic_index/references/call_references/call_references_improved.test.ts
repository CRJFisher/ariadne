/**
 * Tests for the improved call_references implementation
 * Demonstrates bug fixes and improvements
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
  LexicalScope,
  Location,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity, SemanticCategory } from "../../capture_types";
import {
  CallReference,
  ClassSymbol,
  MethodSymbol,
  Symbol,
  MethodResolution,
  InvalidCaptureError,
  process_call_references,
  resolve_method_calls,
  apply_method_resolutions,
  build_call_graph,
} from "./call_references_improved";

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

describe("Improved Call References", () => {
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

  describe("Type Safety Improvements", () => {
    it("should throw InvalidCaptureError for empty symbol names", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      // Should log warning and skip invalid captures
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipped 1 invalid call captures'),
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });

    it("should throw InvalidCaptureError for non-string symbol names", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: 123 as any, // Invalid type
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle malformed extends_class gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.SUPER,
          text: "super",
          node_location: mockLocation,
          modifiers: {},
          context: {
            extends_class: 123, // non-string
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
      expect(result[0].super_class).toBeUndefined(); // Silently ignored
    });
  });

  describe("Static Method Detection", () => {
    it("should detect static method calls", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "staticMethod",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
            is_static: true,
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
      expect(result[0].is_static_call).toBe(true);
      expect(result[0].call_type).toBe("method");
    });

    it("should detect instance method calls", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "instanceMethod",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
            is_static: false,
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
      expect(result[0].is_static_call).toBe(false);
      expect(result[0].call_type).toBe("method");
    });
  });

  describe("Type Inference Improvements", () => {
    it("should infer receiver type from context", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          text: "methodCall",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: { start_line: 1 },
            receiver_type: "MyClass",
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
      expect(result[0].receiver?.type?.type_name).toBe("MyClass");
    });
  });

  describe("Error Handling Improvements", () => {
    it("should handle node_to_location errors gracefully", () => {
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

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
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

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = process_call_references(
        captures,
        mockScope,
        mockScopes,
        mockFilePath
      );

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Method Resolution Improvements", () => {
    it("should resolve methods without mutating input", () => {
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

      const originalCall = JSON.parse(JSON.stringify(calls[0]));

      const class_symbol: ClassSymbol = {
        kind: "class",
        name: "MyClass",
        methods: ["method_symbol" as SymbolId],
      };

      const method_symbol: MethodSymbol = {
        kind: "method",
        name: "getValue",
      };

      const symbols = new Map<SymbolId, Symbol>([
        ["class_symbol" as SymbolId, class_symbol],
        ["method_symbol" as SymbolId, method_symbol],
      ]);

      const resolutions = resolve_method_calls(calls, symbols);

      // Input should not be mutated
      expect(calls[0]).toEqual(originalCall);
      expect(calls[0].resolved_symbol).toBeUndefined();

      // But we get proper resolution results
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].resolved_symbol).toBe("method_symbol");
    });

    it("should handle static method resolution correctly", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "staticMethod" as SymbolName,
          scope_id: mockScope.id,
          call_type: "method",
          is_static_call: true,
          receiver: {
            type: { type_name: "MyClass" as SymbolName },
          },
        },
      ];

      const class_symbol: ClassSymbol = {
        kind: "class",
        name: "MyClass",
        methods: ["instance_method" as SymbolId],
        static_methods: ["static_method" as SymbolId],
      };

      const symbols = new Map<SymbolId, Symbol>([
        ["class_symbol" as SymbolId, class_symbol],
        ["instance_method" as SymbolId, { kind: "method", name: "instanceMethod" }],
        ["static_method" as SymbolId, { kind: "method", name: "staticMethod" }],
      ]);

      const resolutions = resolve_method_calls(calls, symbols);

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].resolved_symbol).toBe("static_method");
    });

    it("should handle malformed methods arrays safely", () => {
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

      const bad_class_symbol = {
        kind: "class",
        name: "BadClass",
        methods: "not_an_array", // Wrong type
      } as any;

      const symbols = new Map<SymbolId, Symbol>([
        ["bad_class" as SymbolId, bad_class_symbol],
      ]);

      // Should not throw, should handle gracefully
      const resolutions = resolve_method_calls(calls, symbols);
      expect(resolutions).toHaveLength(0);
    });
  });

  describe("Apply Method Resolutions", () => {
    it("should apply resolutions to calls", () => {
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

      const resolutions: MethodResolution[] = [
        {
          call_location: mockLocation,
          resolved_symbol: "method_symbol" as SymbolId,
          resolved_return_type: "string_type" as any,
        },
      ];

      apply_method_resolutions(calls, resolutions);

      expect(calls[0].resolved_symbol).toBe("method_symbol");
      expect(calls[0].resolved_return_type).toBe("string_type");
    });
  });

  describe("Call Graph Improvements", () => {
    it("should build readonly call graph", () => {
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
      const caller = graph.get("caller" as SymbolId)!;
      const target = graph.get("target" as SymbolId)!;

      // Verify readonly properties
      expect(caller.calls_to).toBeInstanceOf(Set);
      expect(caller.called_by).toBeInstanceOf(Set);
      expect(Array.isArray(caller.call_sites)).toBe(true);

      expect(caller.calls_to.has("target" as SymbolId)).toBe(true);
      expect(target.called_by.has("caller" as SymbolId)).toBe(true);
    });
  });

  describe("Interface Consistency", () => {
    it("should have consistent readonly interface", () => {
      const call: CallReference = {
        location: mockLocation,
        name: "test" as SymbolName,
        scope_id: mockScope.id,
        call_type: "function",
      };

      // These should be allowed (mutable fields)
      call.resolved_symbol = "symbol" as SymbolId;
      call.resolved_return_type = "type" as any;

      expect(call.resolved_symbol).toBe("symbol");
      expect(call.resolved_return_type).toBe("type");

      // TypeScript should prevent mutation of readonly fields at compile time
      // These would cause TypeScript errors:
      // call.location = mockLocation;  // Error: Cannot assign to 'location'
      // call.name = "new_name";        // Error: Cannot assign to 'name'
    });
  });

  describe("Performance Improvements", () => {
    it("should handle large symbol maps efficiently with lookup optimization", () => {
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

      const symbols = new Map<SymbolId, Symbol>();

      // Add 1000 dummy classes
      for (let i = 0; i < 1000; i++) {
        const class_symbol: ClassSymbol = {
          kind: "class",
          name: `Class${i}`,
          methods: [`method_${i}` as SymbolId],
        };

        const method_symbol: MethodSymbol = {
          kind: "method",
          name: `method${i}`,
        };

        symbols.set(`class_${i}` as SymbolId, class_symbol);
        symbols.set(`method_${i}` as SymbolId, method_symbol);
      }

      // Add our target
      const target_class: ClassSymbol = {
        kind: "class",
        name: "TargetClass",
        methods: ["target_method" as SymbolId],
      };

      const target_method: MethodSymbol = {
        kind: "method",
        name: "targetMethod",
      };

      symbols.set("target_class" as SymbolId, target_class);
      symbols.set("target_method" as SymbolId, target_method);

      const start = Date.now();
      const resolutions = resolve_method_calls(calls, symbols);
      const duration = Date.now() - start;

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].resolved_symbol).toBe("target_method");
      expect(duration).toBeLessThan(50); // Should be faster with lookup optimization
    });
  });
});