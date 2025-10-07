/**
 * Integration tests for Function Call Resolution
 *
 * Verifies integration with ScopeResolverIndex and ResolutionCache
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
  ImportDefinition,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { SemanticIndex } from "../../index_single_file/semantic_index";

// Helper to create a minimal semantic index
function create_test_index(
  file_path: FilePath,
  functions: Map<SymbolId, FunctionDefinition>,
  scopes: Map<ScopeId, LexicalScope>,
  references: SymbolReference[],
  root_scope_id: ScopeId,
  imports?: Map<SymbolId, ImportDefinition>
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
    imported_symbols: imports || new Map(),
    references,
    exported_symbols: new Map(),
    scope_to_definitions: new Map(),
    type_bindings: new Map(),
    type_members: new Map(),
    type_alias_metadata: new Map(),
  };
}

describe("Function Call Resolution - Integration Tests", () => {
  describe("Scope Resolver Index Integration", () => {
    it("should use scope resolver index for lexical scope resolution", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const outer_scope_id = "function:test.js:outer" as ScopeId;
      const inner_scope_id = "function:test.js:inner" as ScopeId;

      // Create three-level scope hierarchy
      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 20,
              end_column: 0,
            },
            child_ids: [outer_scope_id],
          },
        ],
        [
          outer_scope_id,
          {
            id: outer_scope_id,
            type: "function",
            parent_id: root_scope_id,
            name: "outer" as SymbolName,
            location: {
              file_path,
              start_line: 6,
              start_column: 0,
              end_line: 15,
              end_column: 1,
            },
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            parent_id: outer_scope_id,
            name: "inner" as SymbolName,
            location: {
              file_path,
              start_line: 10,
              start_column: 2,
              end_line: 14,
              end_column: 3,
            },
            child_ids: [],
          },
        ],
      ]);

      // Function defined at root level
      const helper_id = "function:test.js:helper" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          helper_id,
          {
            kind: "function",
            symbol_id: helper_id,
            name: "helper" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path,
              start_line: 2,
              start_column: 0,
              end_line: 4,
              end_column: 1,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      // Call from deeply nested inner scope
      const call_ref: SymbolReference = {
        location: {
          file_path,
          start_line: 12,
          start_column: 4,
          end_line: 12,
          end_column: 12,
        },
        type: "call",
        scope_id: inner_scope_id,
        name: "helper" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        [call_ref],
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      // Should resolve through scope chain: inner -> outer -> root
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(helper_id);
    });

    it("should handle shadowing at multiple levels", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const middle_scope_id = "function:test.js:middle" as ScopeId;
      const inner_scope_id = "function:test.js:inner" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 25,
              end_column: 0,
            },
            child_ids: [middle_scope_id],
          },
        ],
        [
          middle_scope_id,
          {
            id: middle_scope_id,
            type: "function",
            parent_id: root_scope_id,
            name: "middle" as SymbolName,
            location: {
              file_path,
              start_line: 6,
              start_column: 0,
              end_line: 20,
              end_column: 1,
            },
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            parent_id: middle_scope_id,
            name: "inner" as SymbolName,
            location: {
              file_path,
              start_line: 12,
              start_column: 2,
              end_line: 18,
              end_column: 3,
            },
            child_ids: [],
          },
        ],
      ]);

      // Three functions with same name at different levels
      const root_foo_id = "function:test.js:foo:root" as SymbolId;
      const middle_foo_id = "function:test.js:foo:middle" as SymbolId;
      const inner_foo_id = "function:test.js:foo:inner" as SymbolId;

      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          root_foo_id,
          {
            kind: "function",
            symbol_id: root_foo_id,
            name: "foo" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path,
              start_line: 2,
              start_column: 0,
              end_line: 4,
              end_column: 1,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
        [
          middle_foo_id,
          {
            kind: "function",
            symbol_id: middle_foo_id,
            name: "foo" as SymbolName,
            defining_scope_id: middle_scope_id,
            location: {
              file_path,
              start_line: 8,
              start_column: 2,
              end_line: 10,
              end_column: 3,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
        [
          inner_foo_id,
          {
            kind: "function",
            symbol_id: inner_foo_id,
            name: "foo" as SymbolName,
            defining_scope_id: inner_scope_id,
            location: {
              file_path,
              start_line: 14,
              start_column: 4,
              end_line: 16,
              end_column: 5,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      // Call from innermost scope should resolve to innermost definition
      const call_ref: SymbolReference = {
        location: {
          file_path,
          start_line: 17,
          start_column: 4,
          end_line: 17,
          end_column: 9,
        },
        type: "call",
        scope_id: inner_scope_id,
        name: "foo" as SymbolName,
        call_type: "function",
      };

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        [call_ref],
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      // Should resolve to innermost foo (shadowing middle and root)
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(inner_foo_id);
    });
  });

  describe("Cache Integration", () => {
    it("should verify cache is used for repeated lookups in same scope", () => {
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
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 15,
              end_column: 0,
            },
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
            defining_scope_id: root_scope_id,
            location: {
              file_path,
              start_line: 2,
              start_column: 0,
              end_line: 4,
              end_column: 1,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      // Five calls to same function
      const call_refs: SymbolReference[] = Array.from(
        { length: 5 },
        (_, i) => ({
          location: {
            file_path,
            start_line: 8 + i,
            start_column: 2,
            end_line: 8 + i,
            end_column: 10,
          },
          type: "call" as const,
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "function" as const,
        })
      );

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        call_refs,
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      // All 5 calls should resolve
      expect(resolutions.size).toBe(5);

      // Check cache statistics
      const stats = cache.get_stats();

      // First call: cache miss, resolver called
      // Next 4 calls: cache hits (same scope, same name)
      expect(stats.hit_count).toBeGreaterThanOrEqual(4);
      expect(stats.miss_count).toBeGreaterThanOrEqual(1);
      expect(stats.total_entries).toBeGreaterThan(0);

      // Cache hit rate should be high (at least 80%)
      expect(stats.hit_rate).toBeGreaterThanOrEqual(0.8);
    });

    it("should verify cache correctly handles different scopes", () => {
      const file_path = "test.js" as FilePath;
      const root_scope_id = "module:test.js" as ScopeId;
      const scope1_id = "function:test.js:func1" as ScopeId;
      const scope2_id = "function:test.js:func2" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 20,
              end_column: 0,
            },
            child_ids: [scope1_id, scope2_id],
          },
        ],
        [
          scope1_id,
          {
            id: scope1_id,
            type: "function",
            parent_id: root_scope_id,
            name: "func1" as SymbolName,
            location: {
              file_path,
              start_line: 6,
              start_column: 0,
              end_line: 10,
              end_column: 1,
            },
            child_ids: [],
          },
        ],
        [
          scope2_id,
          {
            id: scope2_id,
            type: "function",
            parent_id: root_scope_id,
            name: "func2" as SymbolName,
            location: {
              file_path,
              start_line: 12,
              start_column: 0,
              end_line: 16,
              end_column: 1,
            },
            child_ids: [],
          },
        ],
      ]);

      // Same-named functions in different scopes
      const helper1_id = "function:test.js:helper:1" as SymbolId;
      const helper2_id = "function:test.js:helper:2" as SymbolId;
      const functions = new Map<SymbolId, FunctionDefinition>([
        [
          helper1_id,
          {
            kind: "function",
            symbol_id: helper1_id,
            name: "helper" as SymbolName,
            defining_scope_id: scope1_id,
            location: {
              file_path,
              start_line: 7,
              start_column: 2,
              end_line: 8,
              end_column: 3,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
        [
          helper2_id,
          {
            kind: "function",
            symbol_id: helper2_id,
            name: "helper" as SymbolName,
            defining_scope_id: scope2_id,
            location: {
              file_path,
              start_line: 13,
              start_column: 2,
              end_line: 14,
              end_column: 3,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      // Calls from different scopes
      const call_refs: SymbolReference[] = [
        {
          location: {
            file_path,
            start_line: 9,
            start_column: 2,
            end_line: 9,
            end_column: 10,
          },
          type: "call",
          scope_id: scope1_id,
          name: "helper" as SymbolName,
          call_type: "function",
        },
        {
          location: {
            file_path,
            start_line: 15,
            start_column: 2,
            end_line: 15,
            end_column: 10,
          },
          type: "call",
          scope_id: scope2_id,
          name: "helper" as SymbolName,
          call_type: "function",
        },
      ];

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        call_refs,
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      // Each call should resolve to its local helper
      const call1_key = location_key(call_refs[0].location);
      const call2_key = location_key(call_refs[1].location);

      expect(resolutions.get(call1_key)).toBe(helper1_id);
      expect(resolutions.get(call2_key)).toBe(helper2_id);

      // Cache should have separate entries for each (scope_id, name) pair
      const stats = cache.get_stats();
      expect(stats.total_entries).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty references list", () => {
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
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 0,
            },
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
            defining_scope_id: root_scope_id,
            location: {
              file_path,
              start_line: 2,
              start_column: 0,
              end_line: 4,
              end_column: 1,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        [],
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      expect(resolutions.size).toBe(0);
    });

    it("should handle empty indices", () => {
      const indices = new Map();
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      expect(resolutions.size).toBe(0);
    });

    it("should only process function calls, not other reference types", () => {
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
            location: {
              file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
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
            defining_scope_id: root_scope_id,
            location: {
              file_path,
              start_line: 2,
              start_column: 0,
              end_line: 4,
              end_column: 1,
            },
            is_exported: false,
            signature: {
              parameters: [],
            },
          },
        ],
      ]);

      // Mixed reference types
      const references: SymbolReference[] = [
        {
          location: {
            file_path,
            start_line: 7,
            start_column: 2,
            end_line: 7,
            end_column: 10,
          },
          type: "call",
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "function", // Should be processed
        },
        {
          location: {
            file_path,
            start_line: 8,
            start_column: 2,
            end_line: 8,
            end_column: 10,
          },
          type: "read", // Should be ignored
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
        },
        {
          location: {
            file_path,
            start_line: 9,
            start_column: 2,
            end_line: 9,
            end_column: 10,
          },
          type: "call",
          scope_id: root_scope_id,
          name: "helper" as SymbolName,
          call_type: "method", // Should be ignored (method call)
        },
      ];

      const index = create_test_index(
        file_path,
        functions,
        scopes,
        references,
        root_scope_id
      );
      const indices = new Map([[file_path, index]]);
      const resolver_index = build_scope_resolver_index(indices);
      const cache = create_resolution_cache();

      const resolutions = resolve_function_calls(
        indices,
        resolver_index,
        cache
      );

      // Only the function call should be resolved
      expect(resolutions.size).toBe(1);

      const call_key = location_key(references[0].location);
      expect(resolutions.get(call_key)).toBe(helper_id);
    });
  });
});
