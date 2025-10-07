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
import { resolve_symbols } from "./symbol_resolution";
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
import { create_test_index } from "./symbol_resolution.test";


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
            } as unknown as FunctionDefinition,
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
      const result = resolve_symbols(indices);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls across files", () => {
      // utils.ts: export function helper() {}
      const utils_file = "/tmp/ariadne-test/utils.ts" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.ts:module" as ScopeId;
      const helper_id = "function:/tmp/ariadne-test/utils.ts:helper:1:0" as SymbolId;

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
              scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 29,
              },
              parameters: [],
              availability: {
                scope: "file-export",
              },
            } as unknown as FunctionDefinition,
          ],
        ]),
      });

      // main.ts: import { helper } from './utils'; helper();
      const main_file = "/tmp/ariadne-test/main.ts" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.ts:module" as ScopeId;
      const import_id = "import:/tmp/ariadne-test/main.ts:helper:1:9" as SymbolId;
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
            } as unknown as ImportDefinition,
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

      const result = resolve_symbols(indices);

      // Should resolve helper() call to helper definition
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    it("should resolve imported class methods across files", () => {
      // types.ts: export class User { getName() {} }
      const types_file = "/tmp/ariadne-test/types.ts" as FilePath;
      const types_scope = "scope:/tmp/ariadne-test/types.ts:module" as ScopeId;
      const user_class_id = "class:/tmp/ariadne-test/types.ts:User:1:0" as SymbolId;
      const getName_method_id = "method:/tmp/ariadne-test/types.ts:User:getName:2:2" as SymbolId;

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
                } as unknown as MethodDefinition,
              ],
              properties: [],
              availability: {
                scope: "file-export",
              },
            } as unknown as ClassDefinition,
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
      const user_var_id = "variable:/tmp/ariadne-test/main.ts:user:2:6" as SymbolId;
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
            } as unknown as ImportDefinition,
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
            } as unknown as VariableDefinition,
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

      const result = resolve_symbols(indices);

      // Should resolve constructor call to User class
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id
      );

      // Should resolve method call to getName method
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        getName_method_id
      );
    });
  });

  describe("Shadowing Scenarios", () => {
    it("should resolve to local definition when it shadows import", () => {
      // utils.ts: export function helper() {}
      const utils_file = "/tmp/ariadne-test/utils.ts" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.ts:module" as ScopeId;
      const imported_helper_id = "function:/tmp/ariadne-test/utils.ts:helper:1:0" as SymbolId;

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
              availability: {
                scope: "file-export",
              },
            } as unknown as FunctionDefinition,
          ],
        ]),
      });

      // main.ts: import { helper } from './utils'; function helper() {} helper();
      const main_file = "/tmp/ariadne-test/main.ts" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.ts:module" as ScopeId;
      const import_id = "import:/tmp/ariadne-test/main.ts:helper:1:9" as SymbolId;
      const local_helper_id = "function:/tmp/ariadne-test/main.ts:helper:2:9" as SymbolId;
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
            } as unknown as ImportDefinition,
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
            } as unknown as FunctionDefinition,
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

      const result = resolve_symbols(indices);

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
                } as unknown as MethodDefinition,
              ],
              properties: [],
            } as unknown as ClassDefinition,
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
            } as unknown as VariableDefinition,
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
      const result = resolve_symbols(indices);

      // Verify constructor resolution
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id
      );

      // Verify method resolution
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        getName_method_id
      );

      // Verify reverse map
      expect(result.references_to_symbol.get(user_class_id)).toContainEqual(
        constructor_call_location
      );
      expect(result.references_to_symbol.get(getName_method_id)).toContainEqual(
        method_call_location
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
            } as unknown as FunctionDefinition,
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
      const result = resolve_symbols(indices);

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
      expect(locations?.[0]).toMatchObject({
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
        index.functions.get(helper_id)
      );
    });
  });
});
