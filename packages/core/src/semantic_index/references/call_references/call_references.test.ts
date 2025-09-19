/**
 * Comprehensive tests for call references processing
 *
 * Combines coverage from original tests, bug regression tests,
 * and improved implementation verification tests.
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
  InvalidCaptureError,
  process_call_references,
} from "./call_references";

// Mock dependencies
vi.mock("../../../utils/node_utils", () => ({
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

import { node_to_location } from "../../../utils/node_utils";
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
    id: "scope1" as ScopeId,
    type: "function",
    name: "testFunction" as SymbolName,
    location: mockLocation,
    child_ids: [],
    symbols: new Map(),
    parent_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContainingScope.mockReturnValue(mockScope);
    mockNodeToLocation.mockReturnValue(mockLocation);
  });

  describe("process_call_references", () => {
    it("should process function calls", () => {
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "myFunction",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: "myFunction",
        call_type: "function",
        scope_id: mockScope.id,
        location: mockLocation,
      });
    });

    it("should process method calls", () => {
      const receiverNode = { start_line: 1, start_column: 0 };
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "myMethod",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: receiverNode as any,
          },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: "myMethod",
        call_type: "method",
        scope_id: mockScope.id,
        receiver: {
          location: mockLocation,
        },
      });
    });

    it("should process constructor calls", () => {
      const constructTarget = { start_line: 1, start_column: 5 };
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "MyClass",
          node_location: mockLocation,
          modifiers: {},
          context: {
            construct_target: constructTarget as any,
          },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: "MyClass",
        call_type: "constructor",
        scope_id: mockScope.id,
        construct_target: mockLocation,
      });
    });

    it("should process super calls", () => {
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.SUPER,
          category: SemanticCategory.REFERENCE,
          text: "super",
          node_location: mockLocation,
          modifiers: {},
          context: {
            extends_class: "BaseClass",
          },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: "super",
        call_type: "super",
        scope_id: mockScope.id,
        super_class: "BaseClass",
      });
    });

    it("should detect static method calls", () => {
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "staticMethod",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: {} as any,
            is_static: true,
          },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        name: "staticMethod",
        call_type: "method",
        is_static_call: true,
      });
    });

    it("should handle containing function tracking", () => {
      const functionScope: LexicalScope = {
        id: "func_scope" as ScopeId,
        type: "function",
        name: "parentFunction" as SymbolName,
        location: mockLocation,
        child_ids: [mockScope.id],
        parent_id: null,
        symbols: new Map(),
      };

      const scopeToSymbol = new Map<ScopeId, SymbolId>([
        ["func_scope" as ScopeId, "parent_func_symbol" as SymbolId],
      ]);

      const scopes = new Map<ScopeId, LexicalScope>([
        [functionScope.id, functionScope],
        [mockScope.id, { ...mockScope, parent_id: functionScope.id }],
      ]);

      mockFindContainingScope.mockReturnValue(functionScope);

      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "someCall",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        functionScope,
        scopes,
        mockFilePath,
        scopeToSymbol
      );

      expect(calls[0].containing_function).toBe("parent_func_symbol");
    });

    it("should handle errors gracefully with comprehensive error reporting", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Test invalid text type
      const invalidCaptures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: null as any, // Invalid text
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "   ", // Empty after trim
          node_location: mockLocation,
          modifiers: {},
          context: {
            extends_class: "BaseClass",
          },
        },
      ];

      const calls = process_call_references(
        invalidCaptures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipped 2 invalid call captures:"),
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });

    it("should handle missing containing scope", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFindContainingScope.mockReturnValue(undefined as any);

      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "someCall",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle node_to_location errors in receiver processing", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockNodeToLocation.mockImplementation(() => {
        throw new Error("Invalid node");
      });

      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "method",
          node_location: mockLocation,
          modifiers: {},
          context: {
            receiver_node: {} as any,
          },
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should prevent infinite loops in scope traversal", () => {
      // Create circular scope references
      const scope1: LexicalScope = {
        id: "scope1" as ScopeId,
        type: "function",
        name: "func1" as SymbolName,
        location: mockLocation,
        child_ids: [],
        symbols: new Map(),
        parent_id: "scope2" as ScopeId, // Points to scope2
      };

      const scope2: LexicalScope = {
        id: "scope2" as ScopeId,
        type: "function",
        name: "func2" as SymbolName,
        location: mockLocation,
        child_ids: [],
        symbols: new Map(),
        parent_id: "scope1" as ScopeId, // Points back to scope1 - circular!
      };

      const scopes = new Map<ScopeId, LexicalScope>([
        [scope1.id, scope1],
        [scope2.id, scope2],
      ]);

      const scopeToSymbol = new Map<ScopeId, SymbolId>([
        [scope1.id, "func1_symbol" as SymbolId],
        [scope2.id, "func2_symbol" as SymbolId],
      ]);

      mockFindContainingScope.mockReturnValue(scope1);

      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "someCall",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      // Should not hang due to circular reference
      const calls = process_call_references(
        captures,
        scope1,
        scopes,
        mockFilePath,
        scopeToSymbol
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].containing_function).toBe("func1_symbol");
    });

    it("should filter non-call entities correctly", () => {
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.FUNCTION,
          category: SemanticCategory.DEFINITION,
          text: "notACall",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: "actualCall",
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("actualCall");
    });
  });

  // Resolution tests removed - resolution happens in symbol_resolution Phase 3
  /*
  describe("resolve_method_calls", () => {
    const createClassSymbol = (
      name: string,
      methods: SymbolId[] = [],
      staticMethods: SymbolId[] = []
    ): ClassSymbol => ({
      kind: "class",
      name,
      methods,
      static_methods: staticMethods,
    });

    const createMethodSymbol = (
      name: string,
      isStatic = false,
      returnType?: SymbolName
    ): MethodSymbol => ({
      kind: "method",
      name,
      is_static: isStatic,
      return_type: returnType,
    });

    it("should resolve method calls using class lookup", () => {
      const methodId = "method1" as SymbolId;
      const classId = "class1" as SymbolId;

      const symbols = new Map<SymbolId, Symbol>([
        [classId, createClassSymbol("MyClass", [methodId])],
        [methodId, createMethodSymbol("myMethod")],
      ]);

      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
            name: "myInstance" as SymbolName,
          },
        },
      ];

      const resolutions = resolve_method_calls(calls, symbols);

      expect(resolutions).toHaveLength(0);
    });

    it("should resolve static method calls correctly", () => {
      const staticMethodId = "static_method1" as SymbolId;
      const instanceMethodId = "instance_method1" as SymbolId;
      const classId = "class1" as SymbolId;

      const symbols = new Map<SymbolId, Symbol>([
        [
          classId,
          createClassSymbol("MyClass", [instanceMethodId], [staticMethodId]),
        ],
        [staticMethodId, createMethodSymbol("sameMethodName", true)],
        [instanceMethodId, createMethodSymbol("sameMethodName", false)],
      ]);

      const staticCall: CallReference[] = [
        {
          location: mockLocation,
          name: "sameMethodName" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          is_static_call: true,
          receiver: {
            location: mockLocation,
            name: "myInstance" as SymbolName,
          },
        },
      ];

      const instanceCall: CallReference[] = [
        {
          location: { ...mockLocation, line: 2 },
          name: "sameMethodName" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          is_static_call: false,
          receiver: {
            location: mockLocation,
            name: "myInstance" as SymbolName,
          },
        },
      ];

      const staticResolutions = resolve_method_calls(staticCall, symbols);
      const instanceResolutions = resolve_method_calls(instanceCall, symbols);

      expect(staticResolutions).toHaveLength(0);
      expect(instanceResolutions).toHaveLength(0);
    });

    it("should handle missing class gracefully", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
            name: "nonExistent" as SymbolName,
          },
        },
      ];

      const resolutions = resolve_method_calls(calls, new Map());
      expect(resolutions).toHaveLength(0);
    });

    it("should handle malformed class symbols", () => {
      const classId = "class1" as SymbolId;

      // Class with non-array methods field
      const malformedSymbol = {
        kind: "class",
        name: "MyClass",
        methods: "not_an_array" as any,
      } as ClassSymbol;

      const symbols = new Map<SymbolId, Symbol>([[classId, malformedSymbol]]);

      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
            name: "myInstance" as SymbolName,
          },
        },
      ];

      // Should not crash and return empty results
      const resolutions = resolve_method_calls(calls, symbols);
      expect(resolutions).toHaveLength(0);
    });

    it("should handle missing receiver type", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
          },
        },
      ];

      const resolutions = resolve_method_calls(calls, new Map());
      expect(resolutions).toHaveLength(0);
    });

    it("should skip non-method calls", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myFunction" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "function",
        },
      ];

      const resolutions = resolve_method_calls(calls, new Map());
      expect(resolutions).toHaveLength(0);
    });

    it("should include return type in resolution", () => {
      const methodId = "method1" as SymbolId;
      const classId = "class1" as SymbolId;
      const returnTypeId = "string" as SymbolName;

      const symbols = new Map<SymbolId, Symbol>([
        [classId, createClassSymbol("MyClass", [methodId])],
        [methodId, createMethodSymbol("myMethod", false, returnTypeId)],
      ]);

      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
            name: "myInstance" as SymbolName,
          },
        },
      ];

      const resolutions = resolve_method_calls(calls, symbols);

      expect(resolutions).toHaveLength(0);
    });
  });

  describe("apply_method_resolutions", () => {
    it("should apply resolutions to calls", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
        },
      ];

      const resolutions: MethodResolution[] = [
        {
          call_location: mockLocation,
          resolved_symbol: "method1" as SymbolId,
          resolved_return_type: "string" as SymbolName,
        },
      ];

      apply_method_resolutions(calls, resolutions);

      expect(calls[0].resolved_symbol).toBe("method1");
      expect(calls[0].resolved_return_type).toBe("string");
    });

    it("should handle calls without matching resolutions", () => {
      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "myMethod" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
        },
      ];

      const resolutions: MethodResolution[] = [];

      apply_method_resolutions(calls, resolutions);

      expect(calls[0].resolved_symbol).toBeUndefined();
      expect(calls[0].resolved_return_type).toBeUndefined();
    });
  });
  */

  describe("InvalidCaptureError", () => {
    it("should create error with capture context", () => {
      const capture: NormalizedCapture = {
        entity: SemanticEntity.CALL,
        category: SemanticCategory.REFERENCE,
        text: "invalid",
        node_location: mockLocation,
        modifiers: {},
        context: {},
      };

      const error = new InvalidCaptureError("Test error", capture);

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("InvalidCaptureError");
      expect(error.capture).toBe(capture);
    });
  });

  describe("Edge Cases and Regression Tests", () => {
    it("should handle extremely long symbol names", () => {
      const longName = "a".repeat(1000);
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: longName,
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe(longName);
    });

    it("should handle unicode characters in names", () => {
      const unicodeName = "测试函数名";
      const captures: NormalizedCapture[] = [
        {
          entity: SemanticEntity.CALL,
          category: SemanticCategory.REFERENCE,
          text: unicodeName,
          node_location: mockLocation,
          modifiers: {},
          context: {},
        },
      ];

      const calls = process_call_references(
        captures,
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe(unicodeName);
    });

    it("should handle empty captures array", () => {
      const calls = process_call_references(
        [],
        mockScope,
        new Map(),
        mockFilePath
      );

      expect(calls).toHaveLength(0);
    });

    // Resolution test removed - resolution happens in symbol_resolution Phase 3
    /*
    it("should handle method resolution with many methods", () => {
      const methodIds = Array.from(
        { length: 1000 },
        (_, i) => `method${i}` as SymbolId
      );
      const classId = "bigClass" as SymbolId;

      const symbols = new Map<SymbolId, Symbol>([
        [classId, createClassSymbol("BigClass", methodIds)],
        ...methodIds.map(
          (id, i) =>
            [id, createMethodSymbol(`method${i}`)] as [SymbolId, MethodSymbol]
        ),
      ]);

      const calls: CallReference[] = [
        {
          location: mockLocation,
          name: "method500" as SymbolName,
          scope_id: "scope1" as ScopeId,
          call_type: "method",
          receiver: {
            location: mockLocation,
            name: "bigInstance" as SymbolName,
          },
        },
      ];

      const resolutions = resolve_method_calls(calls, symbols);

      expect(resolutions).toHaveLength(0);
    });

    function createClassSymbol(
      name: string,
      methods: SymbolId[] = [],
      staticMethods: SymbolId[] = []
    ): ClassSymbol {
      return {
        kind: "class",
        name,
        methods,
        static_members: staticMethods,
      };
    }

    function createMethodSymbol(
      name: string,
      isStatic = false,
      returnType?: SymbolName
    ): MethodSymbol {
      return {
        kind: "method",
        name,
        is_static: isStatic,
        return_type: returnType,
      };
    }
    */
  });
});
