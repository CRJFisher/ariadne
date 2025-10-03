/**
 * Tests for Function Call Resolution
 *
 * These tests use manually constructed semantic indices to verify the function
 * resolution logic works correctly. This approach avoids issues with the complex
 * scope structures created by the actual semantic index parser.
 */

import { describe, it, expect } from "vitest";
import { resolve_function_calls } from "./function_resolver";
import { build_scope_resolver_index } from "../scope_resolver_index/scope_resolver_index";
import { create_resolution_cache } from "../resolution_cache/resolution_cache";
import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  SymbolReference,
  LexicalScope,
  FunctionDefinition,
  SemanticIndex,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

// Helper to create a minimal semantic index
function create_test_index(
  file_path: FilePath,
  functions: Map<SymbolId, FunctionDefinition>,
  scopes: Map<ScopeId, LexicalScope>,
  references: SymbolReference[],
  root_scope_id: ScopeId
): SemanticIndex {
  return {
    file_path,
    language: "javascript",
    root_scope_id,
    scopes,
    functions,
    classes: new Map(),
    variables: new Map(),
    interfaces: new Map(),
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
    imported_symbols: new Map(),
    references,
    symbols_by_name: new Map(),
    type_bindings: new Map(),
    type_members: new Map(),
    constructors: new Map(),
  };
}

describe("Function Call Resolution", () => {
  describe("Basic Function Calls", () => {
    it("should resolve local function call in same scope", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const helper_id = "function:test.js:helper" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          helper_id,
          {
            kind: "function",
            symbol_id: helper_id,
            name: "helper" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 4, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: { file: file_path, start_line: 7, start_column: 2, end_line: 7, end_column: 10 },
        type: "call",
        scope_id: root_scope_id,
        name: "helper" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(file_path, functions, scopes, [call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(helper_id);
    });

    it("should resolve function call from nested scope", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const child_scope_id = "block:test.js:main" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [child_scope_id],
          },
        ],
        [
          child_scope_id,
          {
            id: child_scope_id,
            type: "block",
            parent_id: root_scope_id,
            name: null,
            location: { file: file_path, start_line: 6, start_column: 15, end_line: 8, end_column: 1 },
            child_ids: [],
          },
        ],
      ]);

      const helper_id = "function:test.js:helper" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          helper_id,
          {
            kind: "function",
            symbol_id: helper_id,
            name: "helper" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 4, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: { file: file_path, start_line: 7, start_column: 2, end_line: 7, end_column: 10 },
        type: "call",
        scope_id: child_scope_id,
        name: "helper" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(file_path, functions, scopes, [call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(helper_id);
    });

    it("should resolve recursive function call", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const func_scope_id = "function:test.js:factorial" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [func_scope_id],
          },
        ],
        [
          func_scope_id,
          {
            id: func_scope_id,
            type: "function",
            parent_id: root_scope_id,
            name: "factorial" as SymbolName,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 6, end_column: 1 },
            child_ids: [],
          },
        ],
      ]);

      const factorial_id = "function:test.js:factorial:def" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          factorial_id,
          {
            kind: "function",
            symbol_id: factorial_id,
            name: "factorial" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 6, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      // Recursive call from within the function
      const call_ref: SymbolReference = {
        location: { file: file_path, start_line: 4, start_column: 13, end_line: 4, end_column: 32 },
        type: "call",
        scope_id: func_scope_id,
        name: "factorial" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(file_path, functions, scopes, [call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(factorial_id);
    });
  });

  describe("Shadowing", () => {
    it("should resolve to local function when shadowing outer function", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const inner_scope_id = "function:test.js:test" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 15, end_column: 0 },
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            parent_id: root_scope_id,
            name: "test" as SymbolName,
            location: { file: file_path, start_line: 6, start_column: 0, end_line: 11, end_column: 1 },
            child_ids: [],
          },
        ],
      ]);

      const outer_foo_id = "function:test.js:foo:outer" as SymbolId;
      const inner_foo_id = "function:test.js:foo:inner" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          outer_foo_id,
          {
            kind: "function",
            symbol_id: outer_foo_id,
            name: "foo" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 4, end_column: 1 },
            availability: "local",
          },
        ],
        [
          inner_foo_id,
          {
            kind: "function",
            symbol_id: inner_foo_id,
            name: "foo" as SymbolName,
            scope_id: inner_scope_id,
            location: { file: file_path, start_line: 7, start_column: 2, end_line: 9, end_column: 3 },
            availability: "local",
          },
        ],
      ]);

      // Call from inner scope should resolve to inner foo
      const call_ref: SymbolReference = {
        location: { file: file_path, start_line: 10, start_column: 2, end_line: 10, end_column: 7 },
        type: "call",
        scope_id: inner_scope_id,
        name: "foo" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(file_path, functions, scopes, [call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(inner_foo_id);
    });
  });

  describe("Unresolved Calls", () => {
    it("should not resolve call to undefined function", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 5, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: { file: file_path, start_line: 3, start_column: 2, end_line: 3, end_column: 23 },
        type: "call",
        scope_id: root_scope_id,
        name: "nonExistentFunction" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(file_path, new Map(), scopes, [call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.has(call_key)).toBe(false);
    });

    it("should filter out method calls", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      // Method call (should be filtered out)
      const method_call_ref: SymbolReference = {
        location: { file: file_path, start_line: 8, start_column: 0, end_line: 8, end_column: 13 },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method", // This is a method call, not a function call
      };

      const index = create_test_index(file_path, new Map(), scopes, [method_call_ref], root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      // Method calls should not be in resolutions
      expect(resolutions.size).toBe(0);
    });
  });

  describe("Cache Performance", () => {
    it("should cache repeated resolutions", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const helper_id = "function:test.js:helper" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          helper_id,
          {
            kind: "function",
            symbol_id: helper_id,
            name: "helper" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 4, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      // Three calls to the same function
      const call_refs: SymbolReference[] = [
        {
          location: { file: file_path, start_line: 7, start_column: 2, end_line: 7, end_column: 10 },
          type: "call",
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "function",
        },
        {
          location: { file: file_path, start_line: 8, start_column: 2, end_line: 8, end_column: 10 },
          type: "call",
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "function",
        },
        {
          location: { file: file_path, start_line: 9, start_column: 2, end_line: 9, end_column: 10 },
          type: "call",
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "function",
        },
      ];

      const index = create_test_index(file_path, functions, scopes, call_refs, root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      // Should have 3 resolutions
      expect(resolutions.size).toBe(3);

      // Check cache stats - all three calls to same function in same scope
      // After first resolution, next two should be cache hits
      const stats = cache.get_stats();
      expect(stats.total_entries).toBeGreaterThan(0);
      expect(stats.hit_count).toBeGreaterThanOrEqual(2);
    });

    it("should populate cache during resolution", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file_path, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const foo_id = "function:test.js:foo" as SymbolId;
      const bar_id = "function:test.js:bar" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          foo_id,
          {
            kind: "function",
            symbol_id: foo_id,
            name: "foo" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 2, start_column: 0, end_line: 3, end_column: 1 },
            availability: "local",
          },
        ],
        [
          bar_id,
          {
            kind: "function",
            symbol_id: bar_id,
            name: "bar" as SymbolName,
            scope_id: root_scope_id,
            location: { file: file_path, start_line: 4, start_column: 0, end_line: 5, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      const call_refs: SymbolReference[] = [
        {
          location: { file: file_path, start_line: 8, start_column: 2, end_line: 8, end_column: 7 },
          type: "call",
          scope_id: root_scope_id,
          name: "foo" as SymbolName,
          call_type: "function",
        },
        {
          location: { file: file_path, start_line: 9, start_column: 2, end_line: 9, end_column: 7 },
          type: "call",
          scope_id: root_scope_id,
          name: "bar" as SymbolName,
          call_type: "function",
        },
      ];

      const index = create_test_index(file_path, functions, scopes, call_refs, root_scope_id);
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      // Initially cache is empty
      const initial_stats = cache.get_stats();
      expect(initial_stats.total_entries).toBe(0);

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      // Cache should now have entries
      const final_stats = cache.get_stats();
      expect(final_stats.total_entries).toBeGreaterThan(0);

      // Should have 2 resolutions
      expect(resolutions.size).toBe(2);
    });
  });

  describe("Multiple Files", () => {
    it("should handle function calls across multiple files", () => {
      const file1 = "file1.js" as FilePath;
      const file2 = "file2.js" as FilePath;
      const root1 = "module:file1.js" as ScopeId;
      const root2 = "module:file2.js" as ScopeId;

      const scopes1 = new Map<ScopeId, LexicalScope>([
        [
          root1,
          {
            id: root1,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file1, start_line: 1, start_column: 0, end_line: 5, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const scopes2 = new Map<ScopeId, LexicalScope>([
        [
          root2,
          {
            id: root2,
            type: "module",
            parent_id: null,
            name: null,
            location: { file: file2, start_line: 1, start_column: 0, end_line: 8, end_column: 0 },
            child_ids: [],
          },
        ],
      ]);

      const helper_id = "function:file1.js:helper" as SymbolId;
      const local_func_id = "function:file2.js:localFunc" as SymbolId;

      const functions1 = new Map<SymbolId, FunctionDefinition>([
        [
          helper_id,
          {
            kind: "function",
            symbol_id: helper_id,
            name: "helper" as SymbolName,
            scope_id: root1,
            location: { file: file1, start_line: 2, start_column: 0, end_line: 4, end_column: 1 },
            availability: "exported",
          },
        ],
      ]);

      const functions2 = new Map<SymbolId, FunctionDefinition>([
        [
          local_func_id,
          {
            kind: "function",
            symbol_id: local_func_id,
            name: "localFunc" as SymbolName,
            scope_id: root2,
            location: { file: file2, start_line: 6, start_column: 0, end_line: 8, end_column: 1 },
            availability: "local",
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: { file: file2, start_line: 3, start_column: 2, end_line: 3, end_column: 13 },
        type: "call",
        scope_id: root2,
        name: "localFunc" as SymbolName,
        call_type: "function",
      };

      const index1 = create_test_index(file1, functions1, scopes1, [], root1);
      const index2 = create_test_index(file2, functions2, scopes2, [call_ref], root2);

      const indices = new Map([
        [file1, index1],
        [file2, index2],
      ]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(indices, resolver_index, cache);

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(local_func_id);
    });
  });
});
