/**
 * JavaScript Integration Tests for Symbol Resolution
 *
 * Creates realistic SemanticIndex data and validates the complete resolution pipeline:
 * SemanticIndex → resolver index → cache → resolutions
 *
 * Test Coverage:
 * - Local function calls (same scope, nested scopes, shadowing)
 * - Cross-file function calls (imports, re-exports, default exports, aliased imports)
 * - Method calls (object methods, chained calls, constructor results)
 * - Constructor calls (local classes, imported classes)
 * - Complex workflows (import → construct → method chains)
 * - Shadowing scenarios at multiple nesting levels
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
import { create_test_index, build_file_tree } from "./symbol_resolution.test_helpers";

// ============================================================================
// JavaScript Symbol Resolution Integration Tests
// ============================================================================

describe("JavaScript Symbol Resolution Integration", () => {
  describe("Local Function Calls", () => {
    it("resolves local function call in same scope", () => {
      // Code: function helper() { return 42; } function main() { helper(); }
      const file_path = "main.js" as FilePath;
      const module_scope = "scope:main.js:module" as ScopeId;
      const helper_id = "function:main.js:helper:1:0" as SymbolId;
      const call_location = {
        file_path,
        start_line: 2,
        start_column: 2,
        end_line: 2,
        end_column: 8,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 10,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
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
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    it("resolves function call from nested scope", () => {
      // Code: function outer() { function inner() { helper(); } } function helper() {}
      const file_path = "main.js" as FilePath;
      const module_scope = "scope:main.js:module" as ScopeId;
      const inner_scope = "scope:main.js:inner:1:2" as ScopeId;
      const helper_id = "function:main.js:helper:3:0" as SymbolId;
      const call_location = {
        file_path,
        start_line: 1,
        start_column: 32,
        end_line: 1,
        end_column: 38,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 20,
              },
              child_ids: [inner_scope],
            },
          ],
          [
            inner_scope,
            {
              id: inner_scope,
              type: "function",
              parent_id: module_scope,
              name: "inner" as SymbolName,
              location: {
                file_path,
                start_line: 1,
                start_column: 20,
                end_line: 1,
                end_column: 50,
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
                file_path,
                start_line: 3,
                start_column: 0,
                end_line: 3,
                end_column: 20,
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
            scope_id: inner_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    it("handles shadowing - inner function shadows outer", () => {
      // Code: function helper() { return 42; } function outer() { helper(); function helper() { return 100; } }
      const file_path = "main.js" as FilePath;
      const module_scope = "scope:main.js:module" as ScopeId;
      const outer_scope = "scope:main.js:outer:2:0" as ScopeId;
      const global_helper_id = "function:main.js:helper:1:0" as SymbolId;
      const local_helper_id = "function:main.js:helper:2:15" as SymbolId;

      const early_call_location = {
        file_path,
        start_line: 2,
        start_column: 10,
        end_line: 2,
        end_column: 16,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 1,
              },
              child_ids: [outer_scope],
            },
          ],
          [
            outer_scope,
            {
              id: outer_scope,
              type: "function",
              parent_id: module_scope,
              name: "outer" as SymbolName,
              location: {
                file_path,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 70,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            global_helper_id,
            {
              kind: "function",
              symbol_id: global_helper_id,
              name: "helper" as SymbolName,
              scope_id: module_scope,
              location: {
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 35,
              },
              parameters: [],
              defining_scope_id: module_scope,
              is_exported: false,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
          [
            local_helper_id,
            {
              kind: "function",
              symbol_id: local_helper_id,
              name: "helper" as SymbolName,
              scope_id: outer_scope,
              location: {
                file_path,
                start_line: 2,
                start_column: 20,
                end_line: 2,
                end_column: 55,
              },
              parameters: [],
              defining_scope_id: outer_scope,
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
            location: early_call_location,
            scope_id: outer_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      // Call should resolve to local helper due to hoisting in JavaScript
      const call_key = location_key(early_call_location);
      expect(result.resolved_references.get(call_key)).toBe(local_helper_id);
    });
  });

  describe("Cross-File Function Calls", () => {
    it("resolves imported function call", () => {
      // utils.js: export function helper() { return 42; }
      const utils_file = "/tmp/ariadne-test/utils.js" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.js:module" as ScopeId;
      const helper_id =
        "function:/tmp/ariadne-test/utils.js:helper:1:0" as SymbolId;

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
                end_column: 45,
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
                start_column: 7,
                end_line: 1,
                end_column: 45,
              },
              parameters: [],
              defining_scope_id: utils_scope,
              is_exported: true,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
      });

      // main.js: import { helper } from './utils'; helper();
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/main.js:helper:1:9" as SymbolId;
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
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    it("follows re-export chain (A imports B exports C)", () => {
      // base.js: export function core() { return 42; }
      const base_file = "/tmp/ariadne-test/base.js" as FilePath;
      const base_scope = "scope:/tmp/ariadne-test/base.js:module" as ScopeId;
      const core_id = "function:/tmp/ariadne-test/base.js:core:1:0" as SymbolId;

      const base_index = create_test_index(base_file, {
        root_scope_id: base_scope,
        scopes_raw: new Map([
          [
            base_scope,
            {
              id: base_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: base_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 40,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            core_id,
            {
              kind: "function",
              symbol_id: core_id,
              name: "core" as SymbolName,
              scope_id: base_scope,
              location: {
                file_path: base_file,
                start_line: 1,
                start_column: 7,
                end_line: 1,
                end_column: 40,
              },
              parameters: [],
              defining_scope_id: base_scope,
              is_exported: true,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
      });

      // middle.js: export { core } from './base';
      const middle_file = "/tmp/ariadne-test/middle.js" as FilePath;
      const middle_scope =
        "scope:/tmp/ariadne-test/middle.js:module" as ScopeId;
      const middle_import_id =
        "import:/tmp/ariadne-test/middle.js:core:1:9" as SymbolId;

      const middle_index = create_test_index(middle_file, {
        root_scope_id: middle_scope,
        scopes_raw: new Map([
          [
            middle_scope,
            {
              id: middle_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: middle_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 35,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            middle_import_id,
            {
              kind: "import",
              symbol_id: middle_import_id,
              name: "core" as SymbolName,
              scope_id: middle_scope,
              location: {
                file_path: middle_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 13,
              },
              import_path: "./base.js" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: middle_scope,
              is_exported: true,
              export: {
                is_reexport: true,
                is_default: false,
              },
            } as ImportDefinition,
          ],
        ]),
      });

      // main.js: import { core } from './middle'; core();
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const main_import_id =
        "import:/tmp/ariadne-test/main.js:core:1:9" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 4,
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
                end_column: 6,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            main_import_id,
            {
              kind: "import",
              symbol_id: main_import_id,
              name: "core" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 13,
              },
              import_path: "./middle.js" as ModulePath,
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
            name: "core" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [base_file, base_index],
        [middle_file, middle_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      // Should resolve to core in base.js (not middle.js)
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(core_id);
    });

    it("handles aliased imports", () => {
      // utils.js: export function helper() {}
      const utils_file = "/tmp/ariadne-test/utils.js" as FilePath;
      const utils_scope = "scope:/tmp/ariadne-test/utils.js:module" as ScopeId;
      const helper_id =
        "function:/tmp/ariadne-test/utils.js:helper:1:0" as SymbolId;

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
                end_column: 30,
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
                start_column: 7,
                end_line: 1,
                end_column: 30,
              },
              parameters: [],
              defining_scope_id: utils_scope,
              is_exported: true,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
      });

      // main.js: import { helper as myHelper } from './utils'; myHelper();
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/main.js:myHelper:1:9" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 8,
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
                end_column: 10,
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
              name: "myHelper" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 29,
              },
              import_path: "./utils" as ModulePath,
              import_kind: "named",
              original_name: "helper" as SymbolName,
              defining_scope_id: main_scope,
            } as ImportDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "myHelper" as SymbolName,
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
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });
  });

  describe("Method Calls", () => {
    it("resolves method call on constructor result", () => {
      // user.js: export class User { getName() { return "Alice"; } }
      const user_file = "/tmp/ariadne-test/user.js" as FilePath;
      const user_scope = "scope:/tmp/ariadne-test/user.js:module" as ScopeId;
      const user_class_id =
        "class:/tmp/ariadne-test/user.js:User:1:0" as SymbolId;
      const getName_method_id =
        "method:/tmp/ariadne-test/user.js:User:getName:1:20" as SymbolId;

      const user_index = create_test_index(user_file, {
        root_scope_id: user_scope,
        scopes_raw: new Map([
          [
            user_scope,
            {
              id: user_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 65,
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
              scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 7,
                end_line: 1,
                end_column: 65,
              },
              methods: [
                {
                  kind: "method",
                  symbol_id: getName_method_id,
                  name: "getName" as SymbolName,
                  scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 20,
                    end_line: 1,
                    end_column: 50,
                  },
                  parameters: [],
                  parent_class: user_class_id,
                  defining_scope_id: user_scope,
                  is_exported: false,
                  signature: {
                    parameters: [],
                  },
                } as MethodDefinition,
              ],
              properties: [],
              defining_scope_id: user_scope,
              is_exported: true,
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

      // main.js: import { User } from './user'; const user = new User(); user.getName();
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const import_id = "import:/tmp/ariadne-test/main.js:User:1:9" as SymbolId;
      const user_var_id =
        "variable:/tmp/ariadne-test/main.js:user:2:6" as SymbolId;
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
              import_path: "./user" as ModulePath,
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
              defining_scope_id: main_scope,
              is_exported: false,
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
        [user_file, user_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      // Verify constructor call resolves to User class
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id
      );

      // Verify method call resolves to getName method
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        getName_method_id
      );
    });
  });

  describe("Constructor Calls", () => {
    it("resolves local class constructor", () => {
      // Code: class User {} const user = new User();
      const file_path = "main.js" as FilePath;
      const module_scope = "scope:main.js:module" as ScopeId;
      const user_class_id = "class:main.js:User:1:0" as SymbolId;
      const call_location = {
        file_path,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 28,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 30,
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
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 14,
              },
              methods: [],
              properties: [],
              extends: [],
              decorators: [],
              defining_scope_id: module_scope,
              is_exported: false,
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "User" as SymbolName,
            location: call_location,
            scope_id: module_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(user_class_id);
    });

    it("resolves imported class constructor", () => {
      // types.js: export class User {}
      const types_file = "/tmp/ariadne-test/types.js" as FilePath;
      const types_scope = "scope:/tmp/ariadne-test/types.js:module" as ScopeId;
      const user_class_id =
        "class:/tmp/ariadne-test/types.js:User:1:0" as SymbolId;

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
                end_line: 1,
                end_column: 21,
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
                start_column: 7,
                end_line: 1,
                end_column: 21,
              },
              methods: [],
              properties: [],
              extends: [],
              decorators: [],
              defining_scope_id: types_scope,
              is_exported: true,
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
      });

      // main.js: import { User } from './types'; const user = new User();
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const import_id = "import:/tmp/ariadne-test/main.js:User:1:9" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 28,
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
                end_column: 30,
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
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "User" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [types_file, types_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(user_class_id);
    });
  });

  describe("Complex Scenarios", () => {
    it("resolves full workflow: import → construct → method call", () => {
      // repository.js: export class Repository { save(data) { return true; } }
      const repository_file = "/tmp/ariadne-test/repository.js" as FilePath;
      const repository_scope =
        "scope:/tmp/ariadne-test/repository.js:module" as ScopeId;
      const repository_class_id =
        "class:/tmp/ariadne-test/repository.js:Repository:1:0" as SymbolId;
      const save_method_id =
        "method:/tmp/ariadne-test/repository.js:Repository:save:1:30" as SymbolId;

      const repository_index = create_test_index(repository_file, {
        root_scope_id: repository_scope,
        scopes_raw: new Map([
          [
            repository_scope,
            {
              id: repository_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: repository_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 70,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            repository_class_id,
            {
              kind: "class",
              symbol_id: repository_class_id,
              name: "Repository" as SymbolName,
              scope_id: repository_scope,
              location: {
                file_path: repository_file,
                start_line: 1,
                start_column: 7,
                end_line: 1,
                end_column: 70,
              },
              methods: [
                {
                  kind: "method",
                  symbol_id: save_method_id,
                  name: "save" as SymbolName,
                  scope_id: repository_scope,
                  location: {
                    file_path: repository_file,
                    start_line: 1,
                    start_column: 30,
                    end_line: 1,
                    end_column: 60,
                  },
                  parameters: [],
                  parent_class: repository_class_id,
                  defining_scope_id: repository_scope,
                } as MethodDefinition,
              ],
              properties: [],
              extends: [],
              decorators: [],
              defining_scope_id: repository_scope,
              is_exported: true,
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            repository_class_id,
            {
              methods: new Map([["save" as SymbolName, save_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // service.js: import { Repository } from './repository'; export class UserService { ... }
      const service_file = "/tmp/ariadne-test/service.js" as FilePath;
      const service_scope =
        "scope:/tmp/ariadne-test/service.js:module" as ScopeId;
      const service_class_id =
        "class:/tmp/ariadne-test/service.js:UserService:2:0" as SymbolId;
      const saveUser_method_id =
        "method:/tmp/ariadne-test/service.js:UserService:saveUser:3:2" as SymbolId;
      const repo_var_id =
        "variable:/tmp/ariadne-test/service.js:repo:2:15" as SymbolId;
      const service_import_id =
        "import:/tmp/ariadne-test/service.js:Repository:1:9" as SymbolId;

      const service_repo_constructor_location = {
        file_path: service_file,
        start_line: 2,
        start_column: 25,
        end_line: 2,
        end_column: 42,
      };
      const service_save_call_location = {
        file_path: service_file,
        start_line: 3,
        start_column: 15,
        end_line: 3,
        end_column: 29,
      };

      const service_index = create_test_index(service_file, {
        root_scope_id: service_scope,
        scopes_raw: new Map([
          [
            service_scope,
            {
              id: service_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 0,
                end_line: 4,
                end_column: 1,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            service_import_id,
            {
              kind: "import",
              symbol_id: service_import_id,
              name: "Repository" as SymbolName,
              scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 19,
              },
              import_path: "./repository" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: service_scope,
            } as ImportDefinition,
          ],
        ]),
        classes_raw: new Map([
          [
            service_class_id,
            {
              kind: "class",
              symbol_id: service_class_id,
              name: "UserService" as SymbolName,
              scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 2,
                start_column: 7,
                end_line: 4,
                end_column: 1,
              },
              methods: [
                {
                  kind: "method",
                  symbol_id: saveUser_method_id,
                  name: "saveUser" as SymbolName,
                  scope_id: service_scope,
                  location: {
                    file_path: service_file,
                    start_line: 3,
                    start_column: 2,
                    end_line: 3,
                    end_column: 40,
                  },
                  parameters: [],
                  parent_class: service_class_id,
                  defining_scope_id: service_scope,
                } as MethodDefinition,
              ],
              properties: [],
              extends: [],
              decorators: [],
              defining_scope_id: service_scope,
              is_exported: true,
              constructor: [],
            } as ClassDefinition,
          ],
        ]),
        variables_raw: new Map([
          [
            repo_var_id,
            {
              kind: "variable",
              symbol_id: repo_var_id,
              name: "repo" as SymbolName,
              scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 2,
                start_column: 15,
                end_line: 2,
                end_column: 19,
              },
              defining_scope_id: service_scope,
              is_exported: false,
            } as VariableDefinition,
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: service_file,
              start_line: 2,
              start_column: 15,
              end_line: 2,
              end_column: 19,
            }) as LocationKey,
            "Repository" as SymbolName,
          ],
        ]),
        type_members_raw: new Map([
          [
            service_class_id,
            {
              methods: new Map([
                ["saveUser" as SymbolName, saveUser_method_id],
              ]),
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
            name: "Repository" as SymbolName,
            location: service_repo_constructor_location,
            scope_id: service_scope,
          },
          {
            type: "call",
            call_type: "method",
            name: "save" as SymbolName,
            location: service_save_call_location,
            scope_id: service_scope,
            context: {
              receiver_location: {
                file_path: service_file,
                start_line: 3,
                start_column: 10,
                end_line: 3,
                end_column: 14,
              },
              property_chain: ["repo" as SymbolName, "save" as SymbolName],
            },
          },
        ],
      });

      // main.js: import { UserService } from './service'; const service = new UserService(); service.saveUser({...});
      const main_file = "/tmp/ariadne-test/main.js" as FilePath;
      const main_scope = "scope:/tmp/ariadne-test/main.js:module" as ScopeId;
      const main_import_id =
        "import:/tmp/ariadne-test/main.js:UserService:1:9" as SymbolId;
      const service_var_id =
        "variable:/tmp/ariadne-test/main.js:service:2:6" as SymbolId;
      const main_constructor_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 21,
        end_line: 2,
        end_column: 37,
      };
      const main_saveUser_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 0,
        end_line: 3,
        end_column: 30,
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
                end_column: 32,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            main_import_id,
            {
              kind: "import",
              symbol_id: main_import_id,
              name: "UserService" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 9,
                end_line: 1,
                end_column: 20,
              },
              import_path: "./service" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              defining_scope_id: main_scope,
            } as ImportDefinition,
          ],
        ]),
        variables_raw: new Map([
          [
            service_var_id,
            {
              kind: "variable",
              symbol_id: service_var_id,
              name: "service" as SymbolName,
              scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 6,
                end_line: 2,
                end_column: 13,
              },
              defining_scope_id: main_scope,
              is_exported: false,
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
              end_column: 13,
            }) as LocationKey,
            "UserService" as SymbolName,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "UserService" as SymbolName,
            location: main_constructor_location,
            scope_id: main_scope,
          },
          {
            type: "call",
            call_type: "method",
            name: "saveUser" as SymbolName,
            location: main_saveUser_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 3,
                start_column: 0,
                end_line: 3,
                end_column: 7,
              },
              property_chain: [
                "service" as SymbolName,
                "saveUser" as SymbolName,
              ],
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [repository_file, repository_index],
        [service_file, service_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols(indices, root_folder);

      // Verify UserService constructor call in main.js
      const main_constructor_key = location_key(main_constructor_location);
      expect(result.resolved_references.get(main_constructor_key)).toBe(
        service_class_id
      );

      // Verify saveUser method call in main.js
      const main_saveUser_key = location_key(main_saveUser_call_location);
      expect(result.resolved_references.get(main_saveUser_key)).toBe(
        saveUser_method_id
      );

      // Verify Repository constructor call in service.js
      const service_constructor_key = location_key(
        service_repo_constructor_location
      );
      expect(result.resolved_references.get(service_constructor_key)).toBe(
        repository_class_id
      );

      // Verify save method call in service.js
      const service_save_key = location_key(service_save_call_location);
      expect(result.resolved_references.get(service_save_key)).toBe(
        save_method_id
      );
    });

    it("handles local symbol shadowing imported symbol", () => {
      // utils.js: export function helper() {}
      const utils_file = "utils.js" as FilePath;
      const utils_scope = "scope:utils.js:module" as ScopeId;
      const imported_helper_id = "function:utils.js:helper:1:0" as SymbolId;

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
                end_column: 30,
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
                start_column: 7,
                end_line: 1,
                end_column: 30,
              },
              parameters: [],
              defining_scope_id: utils_scope,
              is_exported: false,
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
      });

      // main.js: import { helper } from './utils'; function helper() {} helper();
      const main_file = "main.js" as FilePath;
      const main_scope = "scope:main.js:module" as ScopeId;
      const import_id = "import:main.js:helper:1:9" as SymbolId;
      const local_helper_id = "function:main.js:helper:2:9" as SymbolId;
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
              import_path: "./utils.js" as ModulePath,
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
              defining_scope_id: main_scope,
              is_exported: false,
              signature: {
                parameters: [],
              },
              parameters: [],
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
      const result = resolve_symbols(indices, root_folder);

      // Should resolve to LOCAL helper, not imported one (shadowing)
      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(local_helper_id);
    });
  });
});
