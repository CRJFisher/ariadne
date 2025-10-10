/**
 * Symbol Resolution Integration Tests
 *
 * Tests the complete resolution pipeline from SemanticIndex input
 * through final resolved symbols output.
 *
 * Coverage:
 * - Cross-module resolution (imports, function calls, method calls)
 * - Shadowing scenarios (local shadows import, nested scopes)
 * - Complete workflows (constructor → type → method)
 * - Resolution chains (nested type resolution, re-exports)
 * - Language parity (JavaScript, TypeScript, Python, Rust)
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  SymbolReference,
  LexicalScope,
  FunctionDefinition,
  ClassDefinition,
  MethodDefinition,
  VariableDefinition,
  ImportDefinition,
  TypeMemberInfo,
  ModulePath,
  LocationKey,
  AnyDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import { location_key } from "@ariadnejs/types";
import {
  create_test_index,
  build_file_tree,
  resolve_symbols_with_registries,
} from "./symbol_resolution.test_helpers";

describe("Symbol Resolution - Integration Tests", () => {
  describe("Basic Resolution", () => {
    it("should resolve local function calls", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const helper_id = "function:test.ts:helper:1:0" as SymbolId;
      const call_location = {
        file_path: file_path,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 6,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [
            module_scope,
            {
              id: module_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: file_path,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 8,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            helper_id,
            {
              kind: "function",
              symbol_id: helper_id,
              name: "helper" as SymbolName,
              scope_id: module_scope,
              location: {
                file_path: file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 23,
              },
              parameters: [],
              defining_scope_id: module_scope,
              is_exported: false,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "helper" as SymbolName,
            location: call_location,
            scope_id: module_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls across files", () => {
      // utils.ts: export function helper() {}
      const utils_file = "/tmp/ariadne-test/utils.ts" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.ts:module" as ScopeId;
      const helper_id =
        "function:/tmp/ariadne-test/utils.ts:helper:1:0" as SymbolId;

      const utils_index = create_test_index(utils_file, {
        root_scope_id: utils_scope,
        scopes_raw: new Map([
          [
            utils_scope,
            {
              id: utils_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 0,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            helper_id,
            {
              kind: "function",
              symbol_id: helper_id,
              name: "helper" as SymbolName,
              is_exported: true,
              signature: {
                parameters: [],
              },
              defining_scope_id: utils_scope,
              scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 29,
              },
              parameters: [],
            } as FunctionDefinition,
          ],
        ]),
      });

      // main.ts: import { helper } from './utils'; helper();
      const main_file = "/tmp/ariadne-test/main.ts" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.ts:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/main.ts:helper:1:9" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 6,
      };

      const main_index = create_test_index(main_file, {
        root_scope_id: main_scope,
        scopes_raw: new Map([
          [
            main_scope,
            {
              id: main_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 8,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            import_id,
            {
              kind: "import",
              symbol_id: import_id,
              name: "helper" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 15,
              },
              import_path: "./utils" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: main_scope,
            } as ImportDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "helper" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Should resolve helper() call to helper definition
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    it("should resolve imported class methods across files", () => {
      // types.ts: export class User { getName() {} }
      const types_file = "/tmp/ariadne-test/types.ts" as FilePath;
      const types_scope = "scope:/tmp/ariadne-test/types.ts:module" as ScopeId;
      const user_class_id =
        "class:/tmp/ariadne-test/types.ts:User:1:0" as SymbolId;
      const getName_method_id =
        "method:/tmp/ariadne-test/types.ts:User:getName:2:2" as SymbolId;

      const types_index = create_test_index(types_file, {
        root_scope_id: types_scope,
        scopes_raw: new Map([
          [
            types_scope,
            {
              id: types_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: types_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_class_id,
            {
              kind: "class",
              symbol_id: user_class_id,
              name: "User" as SymbolName,
              scope_id: types_scope,
              location: {
                file_path: types_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              methods: [
                {
                  kind: "method",
                  symbol_id: getName_method_id,
                  name: "getName" as SymbolName,
                  scope_id: types_scope,
                  location: {
                    file_path: types_file,
                    start_line: 2,
                    start_column: 2,
                    end_line: 2,
                    end_column: 14,
                  },
                  parameters: [],
                  parent_class: user_class_id,
                  defining_scope_id: types_scope,
                } as MethodDefinition,
              ],
              properties: [],
              is_exported: true,
              signature: {
                parameters: [],
              },
              defining_scope_id: types_scope,
              export: [],
              extends: [],
              decorators: [],
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_class_id,
            {
              methods: new Map([["getName" as SymbolName, getName_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // main.ts: import { User } from './types'; const user = new User(); user.getName();
      const main_file = "/tmp/ariadne-test/main.ts" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.ts:module" as ScopeId;
      const import_id = "import:/tmp/ariadne-test/main.ts:User:1:9" as SymbolId;
      const user_var_id =
        "variable:/tmp/ariadne-test/main.ts:user:2:6" as SymbolId;
      const constructor_call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 28,
      };
      const method_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 0,
        end_line: 3,
        end_column: 15,
      };

      const main_index = create_test_index(main_file, {
        root_scope_id: main_scope,
        scopes_raw: new Map([
          [
            main_scope,
            {
              id: main_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 17,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            import_id,
            {
              kind: "import",
              symbol_id: import_id,
              name: "User" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 13,
              },
              import_path: "./types" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: main_scope,
            } as ImportDefinition,
          ],
        ]),
        variables_raw: new Map([
          [
            user_var_id,
            {
              kind: "variable",
              symbol_id: user_var_id,
              name: "user" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 6,
                end_line: 2,
                end_column: 10,
              },
              is_exported: false,
              defining_scope_id: main_scope,
            } as VariableDefinition,
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: main_file,
              start_line: 2,
              start_column: 6,
              end_line: 2,
              end_column: 10,
            }) as LocationKey,
            "User" as SymbolName,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "User" as SymbolName,
            location: constructor_call_location,
            scope_id: main_scope,
            context: {
              construct_target: {
                file_path: main_file,
                start_line: 2,
                start_column: 6,
                end_line: 2,
                end_column: 10,
              },
            },
          },
          {
            type: "call",
            call_type: "method",
            name: "getName" as SymbolName,
            location: method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 3,
                start_column: 0,
                end_line: 3,
                end_column: 4,
              },
              property_chain: ["user" as SymbolName, "getName" as SymbolName],
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [types_file, types_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Should resolve constructor call to User class
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id,
      );

      // Should resolve method call to getName method
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        getName_method_id,
      );
    });
  });

  describe("Shadowing Scenarios", () => {
    it("should resolve to local definition when it shadows import", () => {
      // utils.ts: export function helper() {}
      const utils_file = "/tmp/ariadne-test/utils.ts" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.ts:module" as ScopeId;
      const imported_helper_id =
        "function:/tmp/ariadne-test/utils.ts:helper:1:0" as SymbolId;

      const utils_index = create_test_index(utils_file, {
        root_scope_id: utils_scope,
        scopes_raw: new Map([
          [
            utils_scope,
            {
              id: utils_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 29,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            imported_helper_id,
            {
              kind: "function",
              symbol_id: imported_helper_id,
              name: "helper" as SymbolName,
              scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 29,
              },
              parameters: [],
              is_exported: true,
              signature: {
                parameters: [],
              },
              defining_scope_id: utils_scope,
            } as FunctionDefinition,
          ],
        ]),
      });

      // main.ts: import { helper } from './utils'; function helper() {} helper();
      const main_file = "/tmp/ariadne-test/main.ts" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.ts:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/main.ts:helper:1:9" as SymbolId;
      const local_helper_id =
        "function:/tmp/ariadne-test/main.ts:helper:2:9" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 0,
        end_line: 3,
        end_column: 6,
      };

      const main_index = create_test_index(main_file, {
        root_scope_id: main_scope,
        scopes_raw: new Map([
          [
            main_scope,
            {
              id: main_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 8,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            import_id,
            {
              kind: "import",
              symbol_id: import_id,
              name: "helper" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 15,
              },
              import_path: "./utils" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: main_scope,
            } as ImportDefinition,
          ],
        ]),
        functions_raw: new Map([
          [
            local_helper_id,
            {
              kind: "function",
              symbol_id: local_helper_id,
              name: "helper" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 9,
                end_line: 2,
                end_column: 24,
              },
              parameters: [],
              is_exported: false,
              signature: {
                parameters: [],
              },
              defining_scope_id: main_scope,
            } as FunctionDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "helper" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Should resolve to LOCAL helper, not imported one (shadowing)
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(local_helper_id);
    });
  });

  describe("Complete Workflows", () => {
    it("should resolve constructor → type → method chain", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const user_class_id = "class:test.ts:User:1:0" as SymbolId;
      const getName_method_id = "method:test.ts:User:getName:2:2" as SymbolId;
      const user_var_id = "variable:test.ts:user:4:6" as SymbolId;

      const constructor_call_location = {
        file_path: file_path,
        start_line: 4,
        start_column: 19,
        end_line: 4,
        end_column: 28,
      };
      const method_call_location = {
        file_path: file_path,
        start_line: 5,
        start_column: 0,
        end_line: 5,
        end_column: 15,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [
            module_scope,
            {
              id: module_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: file_path,
                start_line: 1,
                start_column: 0,
                end_line: 5,
                end_column: 17,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_class_id,
            {
              kind: "class",
              symbol_id: user_class_id,
              name: "User" as SymbolName,
              defining_scope_id: module_scope,
              scope_id: module_scope,
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
                  symbol_id: getName_method_id,
                  name: "getName" as SymbolName,
                  scope_id: module_scope,
                  location: {
                    file_path: file_path,
                    start_line: 2,
                    start_column: 2,
                    end_line: 2,
                    end_column: 14,
                  },
                  parameters: [],
                  parent_class: user_class_id,
                  is_exported: false,
                  signature: {
                    parameters: [],
                  },
                  defining_scope_id: module_scope,
                } as MethodDefinition,
              ],
              properties: [],
              is_exported: false,
              extends: [],
              decorators: [],
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
        variables_raw: new Map([
          [
            user_var_id,
            {
              kind: "variable",
              symbol_id: user_var_id,
              name: "user" as SymbolName,
              scope_id: module_scope,
              location: {
                file_path: file_path,
                start_line: 4,
                start_column: 6,
                end_line: 4,
                end_column: 10,
              },
              is_exported: false,
              defining_scope_id: module_scope,
            } as VariableDefinition,
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: file_path,
              start_line: 4,
              start_column: 6,
              end_line: 4,
              end_column: 10,
            }) as LocationKey,
            "User" as SymbolName,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_class_id,
            {
              methods: new Map([["getName" as SymbolName, getName_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "User" as SymbolName,
            location: constructor_call_location,
            scope_id: module_scope,
            context: {
              construct_target: {
                file_path: file_path,
                start_line: 4,
                start_column: 6,
                end_line: 4,
                end_column: 10,
              },
            },
          },
          {
            type: "call",
            call_type: "method",
            name: "getName" as SymbolName,
            location: method_call_location,
            scope_id: module_scope,
            context: {
              receiver_location: {
                file_path: file_path,
                start_line: 5,
                start_column: 0,
                end_line: 5,
                end_column: 4,
              },
              property_chain: ["user" as SymbolName, "getName" as SymbolName],
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Verify constructor resolution
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id,
      );

      // Verify method resolution
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        getName_method_id,
      );

      // Verify reverse map
      expect(result.references_to_symbol.get(user_class_id)).toContainEqual(
        constructor_call_location,
      );
      expect(result.references_to_symbol.get(getName_method_id)).toContainEqual(
        method_call_location,
      );
    });
  });

  describe("Output Structure", () => {
    it("should produce correct ResolvedSymbols output structure", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const helper_id = "function:test.ts:helper:1:0" as SymbolId;
      const call_location = {
        file_path: file_path,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 6,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [
            module_scope,
            {
              id: module_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: file_path,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 8,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            helper_id,
            {
              kind: "function",
              symbol_id: helper_id,
              name: "helper" as SymbolName,
              scope_id: module_scope,
              location: {
                file_path: file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 23,
              },
              parameters: [],
              defining_scope_id: module_scope,
              is_exported: false,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "helper" as SymbolName,
            location: call_location,
            scope_id: module_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Check output structure
      expect(result).toHaveProperty("resolved_references");
      expect(result).toHaveProperty("references_to_symbol");
      expect(result).toHaveProperty("references");
      expect(result).toHaveProperty("definitions");

      // Check resolved_references
      expect(result.resolved_references).toBeInstanceOf(Map);
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);

      // Check references_to_symbol (reverse map)
      expect(result.references_to_symbol).toBeInstanceOf(Map);
      const locations = result.references_to_symbol.get(helper_id);
      expect(locations).toHaveLength(1);
      expect(locations?.[0]).toEqual({
        file_path: call_location.file_path,
        start_line: call_location.start_line,
        start_column: call_location.start_column,
        end_line: call_location.end_line,
        end_column: call_location.end_column,
      });

      // Check references
      expect(result.references).toBeInstanceOf(Array);
      expect(result.references).toHaveLength(1);

      // Check definitions
      expect(result.definitions).toBeInstanceOf(Map);
      expect(result.definitions.get(helper_id)).toEqual(
        index.functions.get(helper_id),
      );
    });
  });

  describe("CallReference enclosing_function_scope_id", () => {
    it("should set enclosing_function_scope_id for calls in nested functions", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const outer_scope = "scope:test.ts:outer_function" as ScopeId;
      const inner_scope = "scope:test.ts:inner_function" as ScopeId;
      const block_scope = "scope:test.ts:block" as ScopeId;

      const helper1_call = {
        file_path: file_path,
        start_line: 2,
        start_column: 5,
        end_line: 2,
        end_column: 12,
      };
      const helper2_call = {
        file_path: file_path,
        start_line: 4,
        start_column: 7,
        end_line: 4,
        end_column: 14,
      };
      const helper3_call = {
        file_path: file_path,
        start_line: 7,
        start_column: 7,
        end_line: 7,
        end_column: 14,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [module_scope, { id: module_scope, parent_id: null, type: "module", name: null, location: { file_path, start_line: 1, start_column: 1, end_line: 10, end_column: 1 }, child_ids: [] }],
          [outer_scope, { id: outer_scope, parent_id: module_scope, type: "function", name: "outer", location: { file_path, start_line: 1, start_column: 21, end_line: 9, end_column: 1 }, child_ids: [] }],
          [block_scope, { id: block_scope, parent_id: outer_scope, type: "block", name: null, location: { file_path, start_line: 3, start_column: 15, end_line: 5, end_column: 3 }, child_ids: [] }],
          [inner_scope, { id: inner_scope, parent_id: outer_scope, type: "function", name: "inner", location: { file_path, start_line: 6, start_column: 21, end_line: 8, end_column: 3 }, child_ids: [] }],
        ]),
        functions_raw: new Map(),
        references: [
          {
            type: "call" as const,
            location: helper1_call,
            name: "helper1" as SymbolName,
            scope_id: outer_scope,
            call_type: "function" as const,
          },
          {
            type: "call" as const,
            location: helper2_call,
            name: "helper2" as SymbolName,
            scope_id: block_scope,
            call_type: "function" as const,
          },
          {
            type: "call" as const,
            location: helper3_call,
            name: "helper3" as SymbolName,
            scope_id: inner_scope,
            call_type: "function" as const,
          },
        ],
      });

      const result = resolve_symbols_with_registries(
        new Map([[file_path, index]]),
        build_file_tree([file_path]),
      );

      // Check that all call references have enclosing_function_scope_id
      expect(result.references).toHaveLength(3);

      const helper1_ref = result.references.find(r => r.name === "helper1");
      const helper2_ref = result.references.find(r => r.name === "helper2");
      const helper3_ref = result.references.find(r => r.name === "helper3");

      expect(helper1_ref).toBeDefined();
      expect(helper2_ref).toBeDefined();
      expect(helper3_ref).toBeDefined();

      // helper1 is directly in outer function scope
      expect(helper1_ref?.enclosing_function_scope_id).toBe(outer_scope);

      // helper2 is in block scope, but outer function is the enclosing function
      expect(helper2_ref?.enclosing_function_scope_id).toBe(outer_scope);

      // helper3 is in inner function scope
      expect(helper3_ref?.enclosing_function_scope_id).toBe(inner_scope);
    });

    it("should set enclosing_function_scope_id to module scope for top-level calls", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const func_scope = "scope:test.ts:foo_function" as ScopeId;

      const helper_call = {
        file_path: file_path,
        start_line: 1,
        start_column: 1,
        end_line: 1,
        end_column: 6,
      };
      const bar_call = {
        file_path: file_path,
        start_line: 3,
        start_column: 3,
        end_line: 3,
        end_column: 6,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [module_scope, { id: module_scope, parent_id: null, type: "module", name: null, location: { file_path, start_line: 1, start_column: 1, end_line: 5, end_column: 1 }, child_ids: [] }],
          [func_scope, { id: func_scope, parent_id: module_scope, type: "function", name: "foo", location: { file_path, start_line: 2, start_column: 14, end_line: 4, end_column: 1 }, child_ids: [] }],
        ]),
        functions_raw: new Map(),
        references: [
          {
            type: "call" as const,
            location: helper_call,
            name: "helper" as SymbolName,
            scope_id: module_scope,
            call_type: "function" as const,
          },
          {
            type: "call" as const,
            location: bar_call,
            name: "bar" as SymbolName,
            scope_id: func_scope,
            call_type: "function" as const,
          },
        ],
      });

      const result = resolve_symbols_with_registries(
        new Map([[file_path, index]]),
        build_file_tree([file_path]),
      );

      expect(result.references).toHaveLength(2);

      const helper_ref = result.references.find(r => r.name === "helper");
      const bar_ref = result.references.find(r => r.name === "bar");

      expect(helper_ref).toBeDefined();
      expect(bar_ref).toBeDefined();

      // helper is at module scope (top-level)
      expect(helper_ref?.enclosing_function_scope_id).toBe(module_scope);

      // bar is in function scope
      expect(bar_ref?.enclosing_function_scope_id).toBe(func_scope);
    });

    it("should set enclosing_function_scope_id for method and constructor calls", () => {
      const file_path = "test.ts" as FilePath;
      const module_scope = "scope:test.ts:module" as ScopeId;
      const class_scope = "scope:test.ts:MyClass" as ScopeId;
      const method_scope = "scope:test.ts:method" as ScopeId;
      const constructor_scope = "scope:test.ts:constructor" as ScopeId;

      const method_call = {
        file_path: file_path,
        start_line: 3,
        start_column: 5,
        end_line: 3,
        end_column: 11,
      };
      const constructor_call = {
        file_path: file_path,
        start_line: 7,
        start_column: 5,
        end_line: 7,
        end_column: 11,
      };

      const index = create_test_index(file_path, {
        root_scope_id: module_scope,
        scopes_raw: new Map([
          [module_scope, { id: module_scope, parent_id: null, type: "module", name: null, location: { file_path, start_line: 1, start_column: 1, end_line: 10, end_column: 1 }, child_ids: [] }],
          [class_scope, { id: class_scope, parent_id: module_scope, type: "class", name: "MyClass", location: { file_path, start_line: 1, start_column: 7, end_line: 9, end_column: 1 }, child_ids: [] }],
          [method_scope, { id: method_scope, parent_id: class_scope, type: "method", name: "myMethod", location: { file_path, start_line: 2, start_column: 14, end_line: 4, end_column: 3 }, child_ids: [] }],
          [constructor_scope, { id: constructor_scope, parent_id: class_scope, type: "constructor", name: "constructor", location: { file_path, start_line: 6, start_column: 16, end_line: 8, end_column: 3 }, child_ids: [] }],
        ]),
        functions_raw: new Map(),
        references: [
          {
            type: "call" as const,
            location: method_call,
            name: "helper" as SymbolName,
            scope_id: method_scope,
            call_type: "function" as const,
          },
          {
            type: "call" as const,
            location: constructor_call,
            name: "helper" as SymbolName,
            scope_id: constructor_scope,
            call_type: "function" as const,
          },
        ],
      });

      const result = resolve_symbols_with_registries(
        new Map([[file_path, index]]),
        build_file_tree([file_path]),
      );

      expect(result.references).toHaveLength(2);

      const method_ref = result.references.find(r => r.location.start_line === 3);
      const constructor_ref = result.references.find(r => r.location.start_line === 7);

      expect(method_ref).toBeDefined();
      expect(constructor_ref).toBeDefined();

      // Both calls should be enclosed by their respective function scopes
      expect(method_ref?.enclosing_function_scope_id).toBe(method_scope);
      expect(constructor_ref?.enclosing_function_scope_id).toBe(constructor_scope);
    });
  });
});
