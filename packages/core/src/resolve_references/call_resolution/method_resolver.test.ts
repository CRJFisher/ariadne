/**
 * Tests for Method Call Resolution
 *
 * These tests use manually constructed semantic indices to verify the method
 * resolution logic works correctly. Tests cover:
 * - Basic method calls on typed receivers
 * - Method calls on constructor-initialized receivers
 * - Property chain method calls
 * - Shadowing scenarios
 * - Edge cases (missing receiver, missing type, missing method)
 */

import { describe, it, expect } from "vitest";
import { resolve_method_calls } from "./method_resolver";
import { build_scope_resolver_index } from "../scope_resolver_index/scope_resolver_index";
import { create_resolution_cache } from "../resolution_cache/resolution_cache";
import { build_type_context } from "../type_resolution/type_context";
import { build_file_tree } from "../symbol_resolution.test_helpers";
import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  LocationKey,
  SymbolReference,
  LexicalScope,
  VariableDefinition,
  ClassDefinition,
  TypeMemberInfo,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { SemanticIndex } from "../../index_single_file/semantic_index";
import { DefinitionRegistry } from "../registries/definition_registry";
import { TypeRegistry } from "../registries/type_registry";

// Helper to create a minimal semantic index
function create_test_index(config: {
  file_path: FilePath;
  scopes: Map<ScopeId, LexicalScope>;
  variables?: Map<SymbolId, VariableDefinition>;
  classes?: Map<SymbolId, ClassDefinition>;
  references: SymbolReference[];
  root_scope_id: ScopeId;
  type_bindings?: Map<LocationKey, SymbolName>;
  type_members?: Map<SymbolId, TypeMemberInfo>;
}): SemanticIndex {
  return {
    file_path: config.file_path,
    language: "typescript",
    root_scope_id: config.root_scope_id,
    scopes: config.scopes,
    functions: new Map(),
    classes: config.classes || new Map(),
    variables: config.variables || new Map(),
    interfaces: new Map(),
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
    imported_symbols: new Map(),
    references: config.references,
    exported_symbols: new Map(),
    type_bindings: config.type_bindings || new Map(),
    type_members: config.type_members || new Map(),
    scope_to_definitions: new Map(),
    type_alias_metadata: new Map(),
  };
}

// Helper to create and populate registries from indices
function create_registries(indices: Map<FilePath, any>) {
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();

  for (const [file_path, index] of indices) {
    const all_defs = [
      ...Array.from(index.functions.values()),
      ...Array.from(index.classes.values()),
      ...Array.from(index.variables.values()),
      ...Array.from(index.interfaces.values()),
      ...Array.from(index.enums.values()),
      ...Array.from(index.namespaces.values()),
      ...Array.from(index.types.values()),
      ...Array.from(index.imported_symbols.values()),
    ];
    definitions.update_file(file_path, all_defs);
    types.update_file(file_path, index);
  }

  return { definitions, types };
}

describe("Method Call Resolution", () => {
  describe("Basic Method Calls", () => {
    it("should resolve method call on typed receiver", () => {
      // Code: const user: User = ...; user.getName();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      // Define User class with getName method
      const user_class_id = "class:test.ts:User" as SymbolId;
      const get_name_method_id = "method:test.ts:User:getName" as SymbolId;
      const classes = new Map<SymbolId, ClassDefinition>([
        [
          user_class_id,
          {
            kind: "class",
            symbol_id: user_class_id,
            name: "User" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: get_name_method_id,
                name: "getName" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 4,
                  end_column: 3,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      // Define user variable with explicit type
      const user_var_id = "var:test.ts:user" as SymbolId;
      const user_var_loc = {
        file_path: file_path,
        start_line: 7,
        start_column: 6,
        end_line: 7,
        end_column: 10,
      };
      const variables = new Map<SymbolId, VariableDefinition>([
        [
          user_var_id,
          {
            kind: "variable",
            symbol_id: user_var_id,
            name: "user" as SymbolName,
            defining_scope_id: root_scope_id,
            location: user_var_loc,
            is_exported: false,
          },
        ],
      ]);

      // Type binding: user variable has type User
      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(user_var_loc), "User" as SymbolName],
      ]);

      // Type members: User class has getName method
      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          user_class_id,
          {
            methods: new Map([["getName" as SymbolName, get_name_method_id]]),
            properties: new Map(),
            extends: [],
            constructor: undefined,
          },
        ],
      ]);

      // Method call reference
      const receiver_loc = {
        file_path: file_path,
        start_line: 8,
        start_column: 0,
        end_line: 8,
        end_column: 4,
      };
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 8,
          start_column: 0,
          end_line: 8,
          end_column: 13,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "getName" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: receiver_loc,
          property_chain: ["user", "getName"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(get_name_method_id);
    });

    it("should resolve method call on constructor-initialized receiver", () => {
      // Code: const user = new User(); user.getName();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const user_class_id = "class:test.ts:User" as SymbolId;
      const get_name_method_id = "method:test.ts:User:getName" as SymbolId;
      const classes = new Map<SymbolId, ClassDefinition>([
        [
          user_class_id,
          {
            kind: "class",
            symbol_id: user_class_id,
            name: "User" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: get_name_method_id,
                name: "getName" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 4,
                  end_column: 3,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const user_var_id = "var:test.ts:user" as SymbolId;
      const user_var_loc = {
        file_path: file_path,
        start_line: 7,
        start_column: 6,
        end_line: 7,
        end_column: 10,
      };
      const variables = new Map<SymbolId, VariableDefinition>([
        [
          user_var_id,
          {
            kind: "variable",
            symbol_id: user_var_id,
            name: "user" as SymbolName,
            defining_scope_id: root_scope_id,
            location: user_var_loc,
            is_exported: false,
          },
        ],
      ]);

      // Type binding from constructor: const user = new User()
      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(user_var_loc), "User" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          user_class_id,
          {
            methods: new Map([["getName" as SymbolName, get_name_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      const receiver_loc = {
        file_path: file_path,
        start_line: 8,
        start_column: 0,
        end_line: 8,
        end_column: 4,
      };
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 8,
          start_column: 0,
          end_line: 8,
          end_column: 13,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "getName" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: receiver_loc,
          property_chain: ["user", "getName"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(get_name_method_id);
    });
  });

  describe("Receiver Resolution", () => {
    it("should resolve method call with shadowed receiver", () => {
      // Code:
      // class User { getName() {} }
      // const user: User = ...;
      // function test() {
      //   const user: User = ...;  // Shadows outer user
      //   user.getName();
      // }
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;
      const func_scope_id = "scope:test.ts:func:test" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 15,
              end_column: 0,
            },
            child_ids: [func_scope_id],
          },
        ],
        [
          func_scope_id,
          {
            id: func_scope_id,
            type: "function",
            parent_id: root_scope_id,
            name: "test" as SymbolName,
            location: {
              file_path: file_path,
              start_line: 8,
              start_column: 0,
              end_line: 11,
              end_column: 1,
            },
            child_ids: [],
          },
        ],
      ]);

      const user_class_id = "class:test.ts:User" as SymbolId;
      const get_name_method_id = "method:test.ts:User:getName" as SymbolId;
      const classes = new Map<SymbolId, ClassDefinition>([
        [
          user_class_id,
          {
            kind: "class",
            symbol_id: user_class_id,
            name: "User" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: get_name_method_id,
                name: "getName" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 4,
                  end_column: 3,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      // Outer user variable
      const outer_user_id = "var:test.ts:user:outer" as SymbolId;
      const outer_user_loc = {
        file_path: file_path,
        start_line: 6,
        start_column: 6,
        end_line: 6,
        end_column: 10,
      };

      // Inner user variable (shadows outer)
      const inner_user_id = "var:test.ts:user:inner" as SymbolId;
      const inner_user_loc = {
        file_path: file_path,
        start_line: 9,
        start_column: 8,
        end_line: 9,
        end_column: 12,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          outer_user_id,
          {
            kind: "variable",
            symbol_id: outer_user_id,
            name: "user" as SymbolName,
            defining_scope_id: root_scope_id,
            location: outer_user_loc,
            is_exported: false,
          },
        ],
        [
          inner_user_id,
          {
            kind: "variable",
            symbol_id: inner_user_id,
            name: "user" as SymbolName,
            defining_scope_id: func_scope_id,
            location: inner_user_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(outer_user_loc), "User" as SymbolName],
        [location_key(inner_user_loc), "User" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          user_class_id,
          {
            methods: new Map([["getName" as SymbolName, get_name_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      // Method call in inner scope - should resolve to inner user
      const receiver_loc = {
        file_path: file_path,
        start_line: 10,
        start_column: 2,
        end_line: 10,
        end_column: 6,
      };
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 10,
          start_column: 2,
          end_line: 10,
          end_column: 15,
        },
        type: "call",
        scope_id: func_scope_id,
        name: "getName" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: receiver_loc,
          property_chain: ["user", "getName"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      const call_key = location_key(call_ref.location);
      // Should resolve to the method, receiver shadowing handled by scope resolution
      expect(resolutions.get(call_key)).toBe(get_name_method_id);
    });

    it("should resolve method call with same method on different types", () => {
      // Code:
      // class TypeA { method() {} }
      // class TypeB { method() {} }
      // const a = new TypeA(); a.method();
      // const b = new TypeB(); b.method();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 15,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const type_a_id = "class:test.ts:TypeA" as SymbolId;
      const type_a_method_id = "method:test.ts:TypeA:method" as SymbolId;
      const type_b_id = "class:test.ts:TypeB" as SymbolId;
      const type_b_method_id = "method:test.ts:TypeB:method" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          type_a_id,
          {
            kind: "class",
            symbol_id: type_a_id,
            name: "TypeA" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: type_a_method_id,
                name: "method" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 2,
                  end_column: 12,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
        [
          type_b_id,
          {
            kind: "class",
            symbol_id: type_b_id,
            name: "TypeB" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 5,
              start_column: 0,
              end_line: 7,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: type_b_method_id,
                name: "method" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 12,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const var_a_id = "var:test.ts:a" as SymbolId;
      const var_a_loc = {
        file_path: file_path,
        start_line: 9,
        start_column: 6,
        end_line: 9,
        end_column: 7,
      };
      const var_b_id = "var:test.ts:b" as SymbolId;
      const var_b_loc = {
        file_path: file_path,
        start_line: 10,
        start_column: 6,
        end_line: 10,
        end_column: 7,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          var_a_id,
          {
            kind: "variable",
            symbol_id: var_a_id,
            name: "a" as SymbolName,
            defining_scope_id: root_scope_id,
            location: var_a_loc,
            is_exported: false,
          },
        ],
        [
          var_b_id,
          {
            kind: "variable",
            symbol_id: var_b_id,
            name: "b" as SymbolName,
            defining_scope_id: root_scope_id,
            location: var_b_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(var_a_loc), "TypeA" as SymbolName],
        [location_key(var_b_loc), "TypeB" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          type_a_id,
          {
            methods: new Map([["method" as SymbolName, type_a_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
        [
          type_b_id,
          {
            methods: new Map([["method" as SymbolName, type_b_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      // Call on a
      const call_a_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 11,
          start_column: 0,
          end_line: 11,
          end_column: 10,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 11,
            start_column: 0,
            end_line: 11,
            end_column: 1,
          },
          property_chain: ["a", "method"] as SymbolName[],
        },
      };

      // Call on b
      const call_b_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 12,
          start_column: 0,
          end_line: 12,
          end_column: 10,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 12,
            start_column: 0,
            end_line: 12,
            end_column: 1,
          },
          property_chain: ["b", "method"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_a_ref, call_b_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Should resolve to TypeA.method
      expect(resolutions.get(location_key(call_a_ref.location))).toBe(
        type_a_method_id
      );

      // Should resolve to TypeB.method
      expect(resolutions.get(location_key(call_b_ref.location))).toBe(
        type_b_method_id
      );
    });
  });

  describe("Edge Cases", () => {
    it("should return null for method call without receiver location", () => {
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      // Method call without receiver context
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 10,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        // No context - malformed reference
      };

      const index = create_test_index({
        file_path,
        scopes,
        references: [call_ref],
        root_scope_id,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      expect(resolutions.size).toBe(0);
    });

    it("should return null when receiver not found in scope", () => {
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      // Method call on undefined variable
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 17,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 3,
            start_column: 0,
            end_line: 3,
            end_column: 9,
          },
          property_chain: ["undefined_var", "method"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        references: [call_ref],
        root_scope_id,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      expect(resolutions.size).toBe(0);
    });

    it("should return null when receiver has no type information", () => {
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      // Variable without type information
      const untyped_var_id = "var:test.ts:obj" as SymbolId;
      const variables = new Map<SymbolId, VariableDefinition>([
        [
          untyped_var_id,
          {
            kind: "variable",
            symbol_id: untyped_var_id,
            name: "obj" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 2,
              start_column: 6,
              end_line: 2,
              end_column: 9,
            },
            is_exported: false,
          },
        ],
      ]);

      // No type_bindings - obj has no type

      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 3,
          start_column: 0,
          end_line: 3,
          end_column: 12,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 3,
            start_column: 0,
            end_line: 3,
            end_column: 3,
          },
          property_chain: ["obj", "method"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        references: [call_ref],
        root_scope_id,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      expect(resolutions.size).toBe(0);
    });

    it("should return null when type doesn't have the method", () => {
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const user_class_id = "class:test.ts:User" as SymbolId;
      const classes = new Map<SymbolId, ClassDefinition>([
        [
          user_class_id,
          {
            kind: "class",
            symbol_id: user_class_id,
            name: "User" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            methods: [],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const user_var_id = "var:test.ts:user" as SymbolId;
      const user_var_loc = {
        file_path: file_path,
        start_line: 5,
        start_column: 6,
        end_line: 5,
        end_column: 10,
      };
      const variables = new Map<SymbolId, VariableDefinition>([
        [
          user_var_id,
          {
            kind: "variable",
            symbol_id: user_var_id,
            name: "user" as SymbolName,
            defining_scope_id: root_scope_id,
            location: user_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(user_var_loc), "User" as SymbolName],
      ]);

      // User class has no methods
      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          user_class_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      // Call method that doesn't exist on User
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 6,
          start_column: 0,
          end_line: 6,
          end_column: 13,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "getName" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 6,
            start_column: 0,
            end_line: 6,
            end_column: 4,
          },
          property_chain: ["user", "getName"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      expect(resolutions.size).toBe(0);
    });
  });

  describe("Property Chains", () => {
    it("should resolve simple property chain method call", () => {
      // Code: const container: Container = ...; container.getUser().getName();
      // Current limitation: Only resolves the first receiver (container)
      // Future: Full chain resolution would resolve getUser() return type
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const container_class_id = "class:test.ts:Container" as SymbolId;
      const get_user_method_id = "method:test.ts:Container:getUser" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          container_class_id,
          {
            kind: "class",
            symbol_id: container_class_id,
            name: "Container" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: get_user_method_id,
                name: "getUser" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 4,
                  end_column: 3,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const container_var_id = "var:test.ts:container" as SymbolId;
      const container_var_loc = {
        file_path: file_path,
        start_line: 7,
        start_column: 6,
        end_line: 7,
        end_column: 15,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          container_var_id,
          {
            kind: "variable",
            symbol_id: container_var_id,
            name: "container" as SymbolName,
            defining_scope_id: root_scope_id,
            location: container_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(container_var_loc), "Container" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          container_class_id,
          {
            methods: new Map([["getUser" as SymbolName, get_user_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      // Call: container.getUser()
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 8,
          start_column: 0,
          end_line: 8,
          end_column: 19,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "getUser" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 8,
            start_column: 0,
            end_line: 8,
            end_column: 9,
          },
          property_chain: ["container", "getUser"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(get_user_method_id);
    });

    it("should resolve method call without property_chain (fallback to name)", () => {
      // Edge case: method call reference without property_chain
      // Tests the fallback logic in extract_receiver_name
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const user_class_id = "class:test.ts:User" as SymbolId;
      const get_name_method_id = "method:test.ts:User:getName" as SymbolId;
      const classes = new Map<SymbolId, ClassDefinition>([
        [
          user_class_id,
          {
            kind: "class",
            symbol_id: user_class_id,
            name: "User" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 5,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: get_name_method_id,
                name: "getName" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 4,
                  end_column: 3,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      // Variable named "getName" with User type (unusual but valid edge case)
      const get_name_var_id = "var:test.ts:getName" as SymbolId;
      const get_name_var_loc = {
        file_path: file_path,
        start_line: 7,
        start_column: 6,
        end_line: 7,
        end_column: 13,
      };
      const variables = new Map<SymbolId, VariableDefinition>([
        [
          get_name_var_id,
          {
            kind: "variable",
            symbol_id: get_name_var_id,
            name: "getName" as SymbolName,
            defining_scope_id: root_scope_id,
            location: get_name_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(get_name_var_loc), "User" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          user_class_id,
          {
            methods: new Map([["getName" as SymbolName, get_name_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
      ]);

      // Method call without property_chain - fallback uses call_ref.name
      const receiver_loc = {
        file_path: file_path,
        start_line: 8,
        start_column: 0,
        end_line: 8,
        end_column: 7,
      };
      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 8,
          start_column: 0,
          end_line: 8,
          end_column: 20,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "getName" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: receiver_loc,
          // No property_chain - tests fallback to call_ref.name
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Should resolve using the fallback path (call_ref.name)
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(get_name_method_id);
    });
  });

  describe("Inheritance", () => {
    it("should resolve method from parent class", () => {
      // Code:
      // class Base { baseMethod() {} }
      // class Derived extends Base {}
      // const obj = new Derived();
      // obj.baseMethod();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const base_class_id = "class:test.ts:Base" as SymbolId;
      const base_method_id = "method:test.ts:Base:baseMethod" as SymbolId;
      const derived_class_id = "class:test.ts:Derived" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          base_class_id,
          {
            kind: "class",
            symbol_id: base_class_id,
            name: "Base" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: base_method_id,
                name: "baseMethod" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 2,
                  end_column: 16,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
        [
          derived_class_id,
          {
            kind: "class",
            symbol_id: derived_class_id,
            name: "Derived" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 4,
              start_column: 0,
              end_line: 4,
              end_column: 30,
            },
            methods: [],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const obj_var_id = "var:test.ts:obj" as SymbolId;
      const obj_var_loc = {
        file_path: file_path,
        start_line: 5,
        start_column: 6,
        end_line: 5,
        end_column: 9,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          obj_var_id,
          {
            kind: "variable",
            symbol_id: obj_var_id,
            name: "obj" as SymbolName,
            defining_scope_id: root_scope_id,
            location: obj_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(obj_var_loc), "Derived" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          base_class_id,
          {
            methods: new Map([["baseMethod" as SymbolName, base_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
        [
          derived_class_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: ["Base" as SymbolName],
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 6,
          start_column: 0,
          end_line: 6,
          end_column: 17,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "baseMethod" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 6,
            start_column: 0,
            end_line: 6,
            end_column: 3,
          },
          property_chain: ["obj", "baseMethod"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Should resolve to Base.baseMethod through inheritance
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(base_method_id);
    });

    it("should resolve method from grandparent class", () => {
      // Code:
      // class A { methodA() {} }
      // class B extends A {}
      // class C extends B {}
      // const obj = new C();
      // obj.methodA();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const class_a_id = "class:test.ts:A" as SymbolId;
      const method_a_id = "method:test.ts:A:methodA" as SymbolId;
      const class_b_id = "class:test.ts:B" as SymbolId;
      const class_c_id = "class:test.ts:C" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          class_a_id,
          {
            kind: "class",
            symbol_id: class_a_id,
            name: "A" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: method_a_id,
                name: "methodA" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 2,
                  end_column: 13,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
        [
          class_b_id,
          {
            kind: "class",
            symbol_id: class_b_id,
            name: "B" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 4,
              start_column: 0,
              end_line: 4,
              end_column: 21,
            },
            methods: [],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
        [
          class_c_id,
          {
            kind: "class",
            symbol_id: class_c_id,
            name: "C" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 5,
              start_column: 0,
              end_line: 5,
              end_column: 21,
            },
            methods: [],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const obj_var_id = "var:test.ts:obj" as SymbolId;
      const obj_var_loc = {
        file_path: file_path,
        start_line: 6,
        start_column: 6,
        end_line: 6,
        end_column: 9,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          obj_var_id,
          {
            kind: "variable",
            symbol_id: obj_var_id,
            name: "obj" as SymbolName,
            defining_scope_id: root_scope_id,
            location: obj_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(obj_var_loc), "C" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          class_a_id,
          {
            methods: new Map([["methodA" as SymbolName, method_a_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
        [
          class_b_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: ["A" as SymbolName],
          },
        ],
        [
          class_c_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: ["B" as SymbolName],
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 7,
          start_column: 0,
          end_line: 7,
          end_column: 14,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "methodA" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 7,
            start_column: 0,
            end_line: 7,
            end_column: 3,
          },
          property_chain: ["obj", "methodA"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Should resolve to A.methodA through C -> B -> A inheritance chain
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(method_a_id);
    });

    it("should use most derived implementation for overridden methods", () => {
      // Code:
      // class Base { method() {} }
      // class Derived extends Base { method() {} }
      // const obj = new Derived();
      // obj.method();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const base_class_id = "class:test.ts:Base" as SymbolId;
      const base_method_id = "method:test.ts:Base:method" as SymbolId;
      const derived_class_id = "class:test.ts:Derived" as SymbolId;
      const derived_method_id = "method:test.ts:Derived:method" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          base_class_id,
          {
            kind: "class",
            symbol_id: base_class_id,
            name: "Base" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 3,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: base_method_id,
                name: "method" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 2,
                  start_column: 2,
                  end_line: 2,
                  end_column: 12,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
        [
          derived_class_id,
          {
            kind: "class",
            symbol_id: derived_class_id,
            name: "Derived" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 4,
              start_column: 0,
              end_line: 6,
              end_column: 1,
            },
            methods: [
              {
                kind: "method",
                symbol_id: derived_method_id,
                name: "method" as SymbolName,
                defining_scope_id: root_scope_id,
                location: {
                  file_path: file_path,
                  start_line: 5,
                  start_column: 2,
                  end_line: 5,
                  end_column: 12,
                },
                parameters: [],
              },
            ],
            properties: [],
            extends: [],
            decorators: [],
            constructor: [],
            is_exported: false,
          },
        ],
      ]);

      const obj_var_id = "var:test.ts:obj" as SymbolId;
      const obj_var_loc = {
        file_path: file_path,
        start_line: 7,
        start_column: 6,
        end_line: 7,
        end_column: 9,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          obj_var_id,
          {
            kind: "variable",
            symbol_id: obj_var_id,
            name: "obj" as SymbolName,
            defining_scope_id: root_scope_id,
            location: obj_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(obj_var_loc), "Derived" as SymbolName],
      ]);

      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          base_class_id,
          {
            methods: new Map([["method" as SymbolName, base_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: [],
          },
        ],
        [
          derived_class_id,
          {
            methods: new Map([["method" as SymbolName, derived_method_id]]),
            properties: new Map(),
            constructor: undefined,
            extends: ["Base" as SymbolName],
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 8,
          start_column: 0,
          end_line: 8,
          end_column: 13,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 8,
            start_column: 0,
            end_line: 8,
            end_column: 3,
          },
          property_chain: ["obj", "method"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Should resolve to Derived.method (most derived implementation)
      const call_key = location_key(call_ref.location);
      expect(resolutions.get(call_key)).toBe(derived_method_id);
    });

    it("should handle circular inheritance gracefully", () => {
      // Malformed code, but should not crash
      // class A extends B {}
      // class B extends A {}
      // const obj = new A();
      // obj.method();
      const file_path = "test.ts" as FilePath;
      const root_scope_id = "scope:test.ts:0:0" as ScopeId;

      const scopes = new Map<ScopeId, LexicalScope>([
        [
          root_scope_id,
          {
            id: root_scope_id,
            type: "module",
            parent_id: null,
            name: null,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 10,
              end_column: 0,
            },
            child_ids: [],
          },
        ],
      ]);

      const class_a_id = "class:test.ts:A" as SymbolId;
      const class_b_id = "class:test.ts:B" as SymbolId;

      const classes = new Map<SymbolId, ClassDefinition>([
        [
          class_a_id,
          {
            kind: "class",
            symbol_id: class_a_id,
            name: "A" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 1,
              start_column: 0,
              end_line: 1,
              end_column: 21,
            },
            methods: [],
            extends: [],
            decorators: [],
            constructor: [],
            properties: [],
            is_exported: false,
          },
        ],
        [
          class_b_id,
          {
            kind: "class",
            symbol_id: class_b_id,
            name: "B" as SymbolName,
            defining_scope_id: root_scope_id,
            location: {
              file_path: file_path,
              start_line: 2,
              start_column: 0,
              end_line: 2,
              end_column: 21,
            },
            methods: [],
            extends: [],
            decorators: [],
            constructor: [],
            properties: [],
            is_exported: false,
          },
        ],
      ]);

      const obj_var_id = "var:test.ts:obj" as SymbolId;
      const obj_var_loc = {
        file_path: file_path,
        start_line: 3,
        start_column: 6,
        end_line: 3,
        end_column: 9,
      };

      const variables = new Map<SymbolId, VariableDefinition>([
        [
          obj_var_id,
          {
            kind: "variable",
            symbol_id: obj_var_id,
            name: "obj" as SymbolName,
            defining_scope_id: root_scope_id,
            location: obj_var_loc,
            is_exported: false,
          },
        ],
      ]);

      const type_bindings = new Map<LocationKey, SymbolName>([
        [location_key(obj_var_loc), "A" as SymbolName],
      ]);

      // Circular inheritance: A extends B, B extends A
      const type_members = new Map<SymbolId, TypeMemberInfo>([
        [
          class_a_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: ["B" as SymbolName],
          },
        ],
        [
          class_b_id,
          {
            methods: new Map(),
            properties: new Map(),
            constructor: undefined,
            extends: ["A" as SymbolName],
          },
        ],
      ]);

      const call_ref: SymbolReference = {
        location: {
          file_path: file_path,
          start_line: 4,
          start_column: 0,
          end_line: 4,
          end_column: 13,
        },
        type: "call",
        scope_id: root_scope_id,
        name: "method" as SymbolName,
        call_type: "method",
        context: {
          receiver_location: {
            file_path: file_path,
            start_line: 4,
            start_column: 0,
            end_line: 4,
            end_column: 3,
          },
          property_chain: ["obj", "method"] as SymbolName[],
        },
      };

      const index = create_test_index({
        file_path,
        scopes,
        variables,
        classes,
        references: [call_ref],
        root_scope_id,
        type_bindings,
        type_members,
      });

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const { definitions, types } = create_registries(indices);
      const type_context = build_type_context(indices, definitions, types, resolver_index, cache, new Map());

      // Should not crash
      const resolutions = resolve_method_calls(
        indices,
        resolver_index,
        cache,
        type_context
      );

      // Method doesn't exist, should return null (not crash)
      expect(resolutions.size).toBe(0);
    });
  });
});
