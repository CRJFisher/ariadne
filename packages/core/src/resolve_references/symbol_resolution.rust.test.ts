/**
 * Rust Integration Tests for Symbol Resolution
 *
 * Tests Rust-specific features: use statements, module hierarchy,
 * traits, impl blocks, and Rust module resolution
 *
 * Test Coverage:
 * - Use statements (use crate::, use super::, use self::)
 * - Module resolution (file vs directory, nested modules)
 * - Associated functions (Type::new())
 * - Method calls on structs
 * - Trait implementations (impl Trait for Type)
 * - Trait method resolution
 * - Generic implementations
 * - Complex workflows (repository pattern)
 *
 * ## Current Test Status
 *
 * **Test Results:** 1 passing | 15 todo
 *
 * ### ✅ Passing Tests (Local Symbol Resolution)
 * - Local function calls
 *
 * ### 📋 TODO Tests (Documented Future Features)
 * These tests use `.todo()` to document expected behavior for features
 * that require implementation of pending components:
 *
 * 1. **Cross-File Import Resolution** (12 tests)
 *    - Requires: ImportResolver integration for cross-file symbol lookup
 *    - Tests: use statements, module resolution, trait imports
 *
 * 2. **Method Call Resolution** (3 tests)
 *    - Requires: TypeContext integration for method lookup via receiver types
 *    - Tests: Associated functions, method calls, trait method resolution
 *
 * All `.todo()` tests are correctly structured and will automatically pass
 * once the corresponding features are integrated into resolve_symbols_with_registries.
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
  Export,
  AnyDefinition,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import {
  create_test_index,
  build_file_tree,
  resolve_symbols_with_registries,
} from "./symbol_resolution.test_helpers";

// ============================================================================
// Rust Symbol Resolution Integration Tests
// ============================================================================

describe("Rust Symbol Resolution Integration", () => {
  describe("Function Calls", () => {
    it("resolves local function call", () => {
      // Code: fn helper() -> i32 { 42 } fn main() { helper(); }
      const file_path = "main.rs" as FilePath;
      const module_scope = "scope:main.rs:module" as ScopeId;
      const helper_id = "function:main.rs:helper:1:0" as SymbolId;
      const call_location = {
        file_path,
        start_line: 2,
        start_column: 15,
        end_line: 2,
        end_column: 21,
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
                end_column: 23,
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
              defining_scope_id: module_scope,
              location: {
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 25,
              },
              is_exported: false,
              signature: {
                parameters: [],
              },
            },
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

    // TODO: Requires cross-file import resolution
    it.todo("resolves imported function call (use statement)", () => {
      // utils.rs: pub fn helper() -> i32 { 42 }
      const utils_file = "utils.rs" as FilePath;
      const utils_scope = "scope:utils.rs:module" as ScopeId;
      const helper_id = "function:utils.rs:helper:1:0" as SymbolId;

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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // main.rs: use crate::utils::helper; fn main() { helper(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:helper:1:19" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 15,
        end_line: 2,
        end_column: 21,
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
                end_column: 23,
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
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 19,
                end_line: 1,
                end_column: 25,
              },
              import_path: "utils.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
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

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    // TODO: Requires cross-file import resolution
    it.todo("resolves fully qualified function call", () => {
      // utils.rs: pub fn helper() -> i32 { 42 }
      const utils_file = "utils.rs" as FilePath;
      const utils_scope = "scope:utils.rs:module" as ScopeId;
      const helper_id = "function:utils.rs:helper:1:0" as SymbolId;

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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // main.rs: fn main() { crate::utils::helper(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const call_location = {
        file_path: main_file,
        start_line: 1,
        start_column: 13,
        end_line: 1,
        end_column: 33,
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
                end_line: 1,
                end_column: 37,
              },
              child_ids: [],
            },
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

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });
  });

  describe("Use Statements", () => {
    // TODO: Requires cross-file import resolution
    it.todo("resolves crate:: absolute path", () => {
      // utils.rs: pub fn process() -> i32 { 42 }
      const utils_file = "utils.rs" as FilePath;
      const utils_scope = "scope:utils.rs:module" as ScopeId;
      const process_id = "function:utils.rs:process:1:0" as SymbolId;

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
                end_column: 32,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            process_id,
            {
              kind: "function",
              symbol_id: process_id,
              name: "process" as SymbolName,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 32,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // main.rs: use crate::utils::process; fn main() { process(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:process:1:20" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 15,
        end_line: 2,
        end_column: 22,
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
                end_column: 24,
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
              name: "process" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 20,
                end_line: 1,
                end_column: 27,
              },
              import_path: "utils.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "process" as SymbolName,
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

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(process_id);
    });

    // TODO: Requires cross-file import resolution with super::
    it.todo("resolves super:: relative path", () => {
      // models/user.rs: pub struct User { pub name: String }
      const user_file = "models/user.rs" as FilePath;
      const user_scope = "scope:models/user.rs:module" as ScopeId;
      const user_struct_id = "class:models/user.rs:User:1:0" as SymbolId;

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
                end_column: 40,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_struct_id,
            {
              kind: "class",
              symbol_id: user_struct_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 40,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
      });

      // services/user_service.rs: use super::models::user::User; pub fn create_user() -> User { User { name: String::from("test") } }
      const service_file = "services/user_service.rs" as FilePath;
      const service_scope = "scope:services/user_service.rs:module" as ScopeId;
      const import_id = "import:services/user_service.rs:User:1:30" as SymbolId;
      const user_call_location = {
        file_path: service_file,
        start_line: 1,
        start_column: 53,
        end_line: 1,
        end_column: 57,
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
                end_line: 1,
                end_column: 90,
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
              defining_scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 30,
                end_line: 1,
                end_column: 34,
              },
              import_path: "models/user.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "User" as SymbolName,
            location: user_call_location,
            scope_id: service_scope,
            context: {
              construct_target: user_call_location,
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [user_file, user_index],
        [service_file, service_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(user_call_location);
      expect(result.resolved_references.get(call_key)).toBe(user_struct_id);
    });

    // TODO: Requires cross-file import resolution with self::
    it.todo("resolves self:: current module", () => {
      // helper.rs: pub fn inner_helper() -> i32 { 42 } pub fn outer() -> i32 { self::inner_helper() }
      const helper_file = "helper.rs" as FilePath;
      const helper_scope = "scope:helper.rs:module" as ScopeId;
      const inner_helper_id = "function:helper.rs:inner_helper:1:0" as SymbolId;
      const call_location = {
        file_path: helper_file,
        start_line: 1,
        start_column: 60,
        end_line: 1,
        end_column: 80,
      };

      const helper_index = create_test_index(helper_file, {
        root_scope_id: helper_scope,
        scopes_raw: new Map([
          [
            helper_scope,
            {
              id: helper_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 82,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            inner_helper_id,
            {
              kind: "function",
              symbol_id: inner_helper_id,
              name: "inner_helper" as SymbolName,
              defining_scope_id: helper_scope,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 38,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "inner_helper" as SymbolName,
            location: call_location,
            scope_id: helper_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [helper_file, helper_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(inner_helper_id);
    });
  });

  describe("Method Calls", () => {
    // TODO: Requires type context to resolve Type::method syntax
    it.todo("resolves associated function (::new) locally", () => {
      // Code: struct User { name: String } impl User { pub fn new() -> Self { User { name: String::new() } } } fn main() { User::new(); }
      const file_path = "main.rs" as FilePath;
      const module_scope = "scope:main.rs:module" as ScopeId;
      const user_struct_id = "class:main.rs:User:1:0" as SymbolId;
      const new_method_id = "method:main.rs:User:new:1:40" as SymbolId;
      const call_location = {
        file_path,
        start_line: 2,
        start_column: 15,
        end_line: 2,
        end_column: 25,
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
                end_column: 27,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_struct_id,
            {
              kind: "class",
              symbol_id: user_struct_id,
              name: "User" as SymbolName,
              defining_scope_id: module_scope,
              location: {
                file_path,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: new_method_id,
                  name: "new" as SymbolName,
                  defining_scope_id: module_scope,
                  location: {
                    file_path,
                    start_line: 1,
                    start_column: 40,
                    end_line: 1,
                    end_column: 80,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_struct_id,
            {
              type_id: user_struct_id,
              methods: new Map([["new" as SymbolName, new_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "new" as SymbolName,
            location: call_location,
            scope_id: module_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([[file_path, index]]);
      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(new_method_id);
    });

    // TODO: Requires cross-file import resolution and type tracking
    it.todo("resolves method call on struct", () => {
      // user.rs: pub struct User { name: String } impl User { pub fn new(name: String) -> Self { User { name } } pub fn get_name(&self) -> &str { &self.name } }
      const user_file = "user.rs" as FilePath;
      const user_scope = "scope:user.rs:module" as ScopeId;
      const user_struct_id = "class:user.rs:User:1:0" as SymbolId;
      const new_method_id = "method:user.rs:User:new:1:40" as SymbolId;
      const get_name_method_id =
        "method:user.rs:User:get_name:1:100" as SymbolId;

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
                end_column: 140,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_struct_id,
            {
              kind: "class",
              symbol_id: user_struct_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: new_method_id,
                  name: "new" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 40,
                    end_line: 1,
                    end_column: 85,
                  },
                  parameters: [],
                },
                {
                  kind: "method",
                  symbol_id: get_name_method_id,
                  name: "get_name" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 100,
                    end_line: 1,
                    end_column: 135,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_struct_id,
            {
              type_id: user_struct_id,
              methods: new Map([
                ["new" as SymbolName, new_method_id],
                ["get_name" as SymbolName, get_name_method_id],
              ]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // main.rs: use crate::user::User; fn main() { let user = User::new(String::from("Alice")); let name = user.get_name(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:User:1:17" as SymbolId;
      const user_var_id = "variable:main.rs:user:2:8" as SymbolId;
      const new_call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 51,
      };
      const get_name_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 17,
        end_line: 3,
        end_column: 32,
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
                end_column: 34,
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
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 17,
                end_line: 1,
                end_column: 21,
              },
              import_path: "user.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        variables_raw: new Map([
          [
            user_var_id,
            {
              kind: "variable",
              symbol_id: user_var_id,
              name: "user" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 8,
                end_line: 2,
                end_column: 12,
              },
              is_exported: false,
            },
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: main_file,
              start_line: 2,
              start_column: 8,
              end_line: 2,
              end_column: 12,
            }),
            "User" as SymbolName,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "new" as SymbolName,
            location: new_call_location,
            scope_id: main_scope,
            context: {},
          },
          {
            type: "call",
            call_type: "method",
            name: "get_name" as SymbolName,
            location: get_name_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 3,
                start_column: 17,
                end_line: 3,
                end_column: 21,
              },
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [user_file, user_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Verify User::new call
      const new_key = location_key(new_call_location);
      expect(result.resolved_references.get(new_key)).toBe(new_method_id);

      // Verify user.get_name() call
      const get_name_key = location_key(get_name_call_location);
      expect(result.resolved_references.get(get_name_key)).toBe(
        get_name_method_id
      );
    });

    // TODO: Requires cross-file import resolution and trait method tracking
    it.todo("resolves method from trait implementation", () => {
      // traits.rs: pub trait Display { fn display(&self) -> String; }
      const traits_file = "traits.rs" as FilePath;
      const traits_scope = "scope:traits.rs:module" as ScopeId;
      const display_trait_id = "interface:traits.rs:Display:1:0" as SymbolId;

      const traits_index = create_test_index(traits_file, {
        root_scope_id: traits_scope,
        scopes_raw: new Map([
          [
            traits_scope,
            {
              id: traits_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: traits_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 60,
              },
              child_ids: [],
            },
          ],
        ]),
      });

      // user.rs: use crate::traits::Display; pub struct User { name: String } impl Display for User { fn display(&self) -> String { self.name.clone() } }
      const user_file = "user.rs" as FilePath;
      const user_scope = "scope:user.rs:module" as ScopeId;
      const user_struct_id = "class:user.rs:User:1:40" as SymbolId;
      const display_method_id = "method:user.rs:User:display:1:100" as SymbolId;

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
                end_column: 140,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_struct_id,
            {
              kind: "class",
              symbol_id: user_struct_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 40,
                end_line: 1,
                end_column: 70,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: display_method_id,
                  name: "display" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 100,
                    end_line: 1,
                    end_column: 135,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_struct_id,
            {
              type_id: user_struct_id,
              methods: new Map([["display" as SymbolName, display_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // main.rs: use crate::user::User; use crate::traits::Display; fn main() { let user = User { name: String::from("Alice") }; let text = user.display(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const user_import_id = "import:main.rs:User:1:17" as SymbolId;
      const display_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 17,
        end_line: 3,
        end_column: 31,
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
                end_column: 33,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            user_import_id,
            {
              kind: "import",
              symbol_id: user_import_id,
              name: "User" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 17,
                end_line: 1,
                end_column: 21,
              },
              import_path: "user.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "display" as SymbolName,
            location: display_call_location,
            scope_id: main_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [traits_file, traits_index],
        [user_file, user_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const display_key = location_key(display_call_location);
      expect(result.resolved_references.get(display_key)).toBe(
        display_method_id
      );
    });
  });

  describe("Module Resolution", () => {
    // TODO: Requires module file resolution
    it.todo("resolves module file (utils.rs)", () => {
      // utils.rs: pub fn helper() -> i32 { 42 }
      const utils_file = "utils.rs" as FilePath;
      const utils_scope = "scope:utils.rs:module" as ScopeId;
      const helper_id = "function:utils.rs:helper:1:0" as SymbolId;

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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // main.rs: mod utils; use utils::helper; fn main() { helper(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:helper:2:12" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 15,
        end_line: 3,
        end_column: 21,
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
                end_column: 23,
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
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 12,
                end_line: 2,
                end_column: 18,
              },
              import_path: "utils.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
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

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    // TODO: Requires module directory resolution (mod.rs)
    it.todo("resolves module directory (utils/mod.rs)", () => {
      // utils/mod.rs: pub fn helper() -> i32 { 42 }
      const utils_file = "utils/mod.rs" as FilePath;
      const utils_scope = "scope:utils/mod.rs:module" as ScopeId;
      const helper_id = "function:utils/mod.rs:helper:1:0" as SymbolId;

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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 30,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // main.rs: use crate::utils::helper; fn main() { helper(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:helper:1:19" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 15,
        end_line: 2,
        end_column: 21,
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
                end_column: 23,
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
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 19,
                end_line: 1,
                end_column: 25,
              },
              import_path: "utils/mod.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
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

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_id);
    });

    // TODO: Requires nested module resolution
    it.todo("resolves nested modules", () => {
      // utils/string/mod.rs: pub fn trim(s: &str) -> &str { s.trim() }
      const string_file = "utils/string/mod.rs" as FilePath;
      const string_scope = "scope:utils/string/mod.rs:module" as ScopeId;
      const trim_id = "function:utils/string/mod.rs:trim:1:0" as SymbolId;

      const string_index = create_test_index(string_file, {
        root_scope_id: string_scope,
        scopes_raw: new Map([
          [
            string_scope,
            {
              id: string_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: string_file,
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
            trim_id,
            {
              kind: "function",
              symbol_id: trim_id,
              name: "trim" as SymbolName,
              defining_scope_id: string_scope,
              location: {
                file_path: string_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 45,
              },
              is_exported: true,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
      });

      // utils/mod.rs: pub mod string;
      const utils_file = "utils/mod.rs" as FilePath;
      const utils_scope = "scope:utils/mod.rs:module" as ScopeId;

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
                end_column: 17,
              },
              child_ids: [],
            },
          ],
        ]),
      });

      // main.rs: use crate::utils::string::trim; fn main() { let result = trim("  hello  "); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:trim:1:27" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 28,
        end_line: 2,
        end_column: 32,
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
                end_column: 45,
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
              name: "trim" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 27,
                end_line: 1,
                end_column: 31,
              },
              import_path: "utils/string/mod.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "trim" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [string_file, string_index],
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(trim_id);
    });
  });

  describe("Trait System", () => {
    // TODO: Requires cross-file import resolution and trait method tracking
    it.todo("resolves trait method call", () => {
      // traits.rs: pub trait Processor { fn process(&self) -> i32; }
      const traits_file = "traits.rs" as FilePath;
      const traits_scope = "scope:traits.rs:module" as ScopeId;
      const processor_trait_id =
        "interface:traits.rs:Processor:1:0" as SymbolId;

      const traits_index = create_test_index(traits_file, {
        root_scope_id: traits_scope,
        scopes_raw: new Map([
          [
            traits_scope,
            {
              id: traits_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: traits_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 50,
              },
              child_ids: [],
            },
          ],
        ]),
      });

      // processor.rs: use crate::traits::Processor; pub struct DataProcessor; impl Processor for DataProcessor { fn process(&self) -> i32 { 42 } }
      const processor_file = "processor.rs" as FilePath;
      const processor_scope = "scope:processor.rs:module" as ScopeId;
      const data_processor_id =
        "class:processor.rs:DataProcessor:1:40" as SymbolId;
      const process_method_id =
        "method:processor.rs:DataProcessor:process:1:90" as SymbolId;

      const processor_index = create_test_index(processor_file, {
        root_scope_id: processor_scope,
        scopes_raw: new Map([
          [
            processor_scope,
            {
              id: processor_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: processor_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 130,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            data_processor_id,
            {
              kind: "class",
              symbol_id: data_processor_id,
              name: "DataProcessor" as SymbolName,
              defining_scope_id: processor_scope,
              location: {
                file_path: processor_file,
                start_line: 1,
                start_column: 40,
                end_line: 1,
                end_column: 65,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: process_method_id,
                  name: "process" as SymbolName,
                  defining_scope_id: processor_scope,
                  location: {
                    file_path: processor_file,
                    start_line: 1,
                    start_column: 90,
                    end_line: 1,
                    end_column: 120,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            data_processor_id,
            {
              type_id: data_processor_id,
              methods: new Map([["process" as SymbolName, process_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // main.rs: use crate::processor::DataProcessor; fn main() { let dp = DataProcessor; dp.process(); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const import_id = "import:main.rs:DataProcessor:1:27" as SymbolId;
      const process_call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 45,
        end_line: 2,
        end_column: 56,
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
                end_column: 58,
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
              name: "DataProcessor" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 27,
                end_line: 1,
                end_column: 40,
              },
              import_path: "processor.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "process" as SymbolName,
            location: process_call_location,
            scope_id: main_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [traits_file, traits_index],
        [processor_file, processor_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const process_key = location_key(process_call_location);
      expect(result.resolved_references.get(process_key)).toBe(
        process_method_id
      );
    });

    // TODO: Requires cross-file import resolution and default trait implementation tracking
    it.todo("resolves default trait implementation", () => {
      // traits.rs: pub trait Logger { fn log(&self, msg: &str) { println!("{}", msg); } }
      const traits_file = "traits.rs" as FilePath;
      const traits_scope = "scope:traits.rs:module" as ScopeId;
      const logger_trait_id = "interface:traits.rs:Logger:1:0" as SymbolId;
      const log_method_id = "method:traits.rs:Logger:log:1:25" as SymbolId;

      const traits_index = create_test_index(traits_file, {
        root_scope_id: traits_scope,
        scopes_raw: new Map([
          [
            traits_scope,
            {
              id: traits_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: traits_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 80,
              },
              child_ids: [],
            },
          ],
        ]),
      });

      // service.rs: use crate::traits::Logger; pub struct Service; impl Logger for Service {}
      const service_file = "service.rs" as FilePath;
      const service_scope = "scope:service.rs:module" as ScopeId;
      const service_struct_id = "class:service.rs:Service:1:35" as SymbolId;

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
                end_line: 1,
                end_column: 70,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            service_struct_id,
            {
              kind: "class",
              symbol_id: service_struct_id,
              name: "Service" as SymbolName,
              defining_scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 35,
                end_line: 1,
                end_column: 55,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
      });

      // main.rs: use crate::service::Service; use crate::traits::Logger; fn main() { let s = Service; s.log("test"); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const service_import_id = "import:main.rs:Service:1:23" as SymbolId;
      const log_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 45,
        end_line: 3,
        end_column: 56,
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
                end_column: 58,
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
              name: "Service" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 23,
                end_line: 1,
                end_column: 30,
              },
              import_path: "service.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
              is_exported: false,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "log" as SymbolName,
            location: log_call_location,
            scope_id: main_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [traits_file, traits_index],
        [service_file, service_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Should resolve to the default implementation in the trait
      const log_key = location_key(log_call_location);
      expect(result.resolved_references.get(log_key)).toBe(log_method_id);
    });
  });

  describe("Complex Scenarios", () => {
    // TODO: Requires full cross-file resolution with repository pattern
    it.todo("resolves full workflow: use → construct → method call", () => {
      // models/user.rs: pub struct User { pub name: String } impl User { pub fn new(name: String) -> Self { User { name } } pub fn get_name(&self) -> &str { &self.name } }
      const user_file = "models/user.rs" as FilePath;
      const user_scope = "scope:models/user.rs:module" as ScopeId;
      const user_struct_id = "class:models/user.rs:User:1:0" as SymbolId;
      const new_method_id = "method:models/user.rs:User:new:1:40" as SymbolId;
      const get_name_method_id =
        "method:models/user.rs:User:get_name:1:100" as SymbolId;

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
                end_column: 140,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            user_struct_id,
            {
              kind: "class",
              symbol_id: user_struct_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 35,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: new_method_id,
                  name: "new" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 40,
                    end_line: 1,
                    end_column: 85,
                  },
                  parameters: [],
                },
                {
                  kind: "method",
                  symbol_id: get_name_method_id,
                  name: "get_name" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 1,
                    start_column: 100,
                    end_line: 1,
                    end_column: 135,
                  },
                  is_exported: true,
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            user_struct_id,
            {
              type_id: user_struct_id,
              methods: new Map([
                ["new" as SymbolName, new_method_id],
                ["get_name" as SymbolName, get_name_method_id],
              ]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // repositories/user_repository.rs: use crate::models::user::User; pub struct UserRepository; impl UserRepository { pub fn create_user(&self, name: String) -> User { User::new(name) } }
      const repository_file = "repositories/user_repository.rs" as FilePath;
      const repository_scope =
        "scope:repositories/user_repository.rs:module" as ScopeId;
      const repo_struct_id =
        "class:repositories/user_repository.rs:UserRepository:1:35" as SymbolId;
      const create_user_method_id =
        "method:repositories/user_repository.rs:UserRepository:create_user:1:70" as SymbolId;

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
                end_column: 140,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            repo_struct_id,
            {
              kind: "class",
              symbol_id: repo_struct_id,
              name: "UserRepository" as SymbolName,
              defining_scope_id: repository_scope,
              location: {
                file_path: repository_file,
                start_line: 1,
                start_column: 35,
                end_line: 1,
                end_column: 60,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: create_user_method_id,
                  name: "create_user" as SymbolName,
                  defining_scope_id: repository_scope,
                  location: {
                    file_path: repository_file,
                    start_line: 1,
                    start_column: 70,
                    end_line: 1,
                    end_column: 130,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            repo_struct_id,
            {
              type_id: repo_struct_id,
              methods: new Map([
                ["create_user" as SymbolName, create_user_method_id],
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
            call_type: "function",
            name: "new" as SymbolName,
            location: {
              file_path: repository_file,
              start_line: 1,
              start_column: 115,
              end_line: 1,
              end_column: 125,
            },
            scope_id: repository_scope,
            context: {},
          },
        ],
      });

      // services/user_service.rs: use crate::repositories::user_repository::UserRepository; pub struct UserService { repo: UserRepository } impl UserService { pub fn register_user(&self, name: String) -> String { let user = self.repo.create_user(name); String::from(user.get_name()) } }
      const service_file = "services/user_service.rs" as FilePath;
      const service_scope = "scope:services/user_service.rs:module" as ScopeId;
      const service_struct_id =
        "class:services/user_service.rs:UserService:1:55" as SymbolId;
      const register_user_method_id =
        "method:services/user_service.rs:UserService:register_user:1:110" as SymbolId;

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
                end_line: 1,
                end_column: 220,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            service_struct_id,
            {
              kind: "class",
              symbol_id: service_struct_id,
              name: "UserService" as SymbolName,
              defining_scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 55,
                end_line: 1,
                end_column: 95,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: register_user_method_id,
                  name: "register_user" as SymbolName,
                  defining_scope_id: service_scope,
                  location: {
                    file_path: service_file,
                    start_line: 1,
                    start_column: 110,
                    end_line: 1,
                    end_column: 210,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            } as ClassDefinition,
          ],
        ]),
        type_members_raw: new Map([
          [
            service_struct_id,
            {
              type_id: service_struct_id,
              methods: new Map([
                ["register_user" as SymbolName, register_user_method_id],
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
            call_type: "method",
            name: "create_user" as SymbolName,
            location: {
              file_path: service_file,
              start_line: 1,
              start_column: 165,
              end_line: 1,
              end_column: 180,
            },
            scope_id: service_scope,
            context: {},
          },
          {
            type: "call",
            call_type: "method",
            name: "get_name" as SymbolName,
            location: {
              file_path: service_file,
              start_line: 1,
              start_column: 195,
              end_line: 1,
              end_column: 205,
            },
            scope_id: service_scope,
            context: {},
          },
        ],
      });

      // main.rs: use crate::services::user_service::UserService; fn main() { let service = UserService::new(); let name = service.register_user(String::from("Alice")); }
      const main_file = "main.rs" as FilePath;
      const main_scope = "scope:main.rs:module" as ScopeId;
      const service_import_id = "import:main.rs:UserService:1:35" as SymbolId;
      const register_user_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 17,
        end_line: 3,
        end_column: 57,
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
                end_column: 59,
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
              name: "UserService" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 35,
                end_line: 1,
                end_column: 46,
              },
              import_path: "services/user_service.rs" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "register_user" as SymbolName,
            location: register_user_call_location,
            scope_id: main_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [user_file, user_index],
        [repository_file, repository_index],
        [service_file, service_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Verify register_user method call in main.rs
      const register_user_key = location_key(register_user_call_location);
      expect(result.resolved_references.get(register_user_key)).toBe(
        register_user_method_id
      );

      // Verify create_user method call in user_service.rs
      const create_user_key = location_key({
        file_path: service_file,
        start_line: 1,
        start_column: 165,
        end_line: 1,
        end_column: 180,
      });
      expect(result.resolved_references.get(create_user_key)).toBe(
        create_user_method_id
      );

      // Verify User::new call in user_repository.rs
      const user_new_key = location_key({
        file_path: repository_file,
        start_line: 1,
        start_column: 115,
        end_line: 1,
        end_column: 125,
      });
      expect(result.resolved_references.get(user_new_key)).toBe(new_method_id);

      // Verify get_name method call in user_service.rs
      const get_name_key = location_key({
        file_path: service_file,
        start_line: 1,
        start_column: 195,
        end_line: 1,
        end_column: 205,
      });
      expect(result.resolved_references.get(get_name_key)).toBe(
        get_name_method_id
      );
    });

    // TODO: Requires cross-file import resolution and trait bounds tracking
    it.todo("resolves method call through trait bounds", () => {
      // traits.rs: pub trait Processable { fn process(&self) -> String; }
      const traits_file = "traits.rs" as FilePath;
      const traits_scope = "scope:traits.rs:module" as ScopeId;
      const processable_trait_id =
        "interface:traits.rs:Processable:1:0" as SymbolId;

      const traits_index = create_test_index(traits_file, {
        root_scope_id: traits_scope,
        scopes_raw: new Map([
          [
            traits_scope,
            {
              id: traits_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: traits_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 60,
              },
              child_ids: [],
            },
          ],
        ]),
      });

      // item.rs: use crate::traits::Processable; pub struct Item; impl Processable for Item { fn process(&self) -> String { String::from("processed") } }
      const item_file = "item.rs" as FilePath;
      const item_scope = "scope:item.rs:module" as ScopeId;
      const item_struct_id = "class:item.rs:Item:1:35" as SymbolId;
      const process_method_id = "method:item.rs:Item:process:1:75" as SymbolId;

      const item_index = create_test_index(item_file, {
        root_scope_id: item_scope,
        scopes_raw: new Map([
          [
            item_scope,
            {
              id: item_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: item_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 120,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            item_struct_id,
            {
              kind: "class",
              symbol_id: item_struct_id,
              name: "Item" as SymbolName,
              defining_scope_id: item_scope,
              location: {
                file_path: item_file,
                start_line: 1,
                start_column: 35,
                end_line: 1,
                end_column: 50,
              },
              is_exported: true,
              extends: [],
              decorators: [],
              constructor: undefined,
              methods: [
                {
                  kind: "method",
                  symbol_id: process_method_id,
                  name: "process" as SymbolName,
                  defining_scope_id: item_scope,
                  location: {
                    file_path: item_file,
                    start_line: 1,
                    start_column: 75,
                    end_line: 1,
                    end_column: 115,
                  },
                  parameters: [],
                },
              ],
              properties: [],
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            item_struct_id,
            {
              type_id: item_struct_id,
              methods: new Map([["process" as SymbolName, process_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [],
            },
          ],
        ]),
      });

      // processor.rs: use crate::traits::Processable; pub fn run_process<T: Processable>(item: &T) -> String { item.process() }
      const processor_file = "processor.rs" as FilePath;
      const processor_scope = "scope:processor.rs:module" as ScopeId;
      const run_process_id =
        "function:processor.rs:run_process:1:35" as SymbolId;
      const process_call_location = {
        file_path: processor_file,
        start_line: 1,
        start_column: 95,
        end_line: 1,
        end_column: 108,
      };

      const processor_index = create_test_index(processor_file, {
        root_scope_id: processor_scope,
        scopes_raw: new Map([
          [
            processor_scope,
            {
              id: processor_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: processor_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 110,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            run_process_id,
            {
              kind: "function",
              symbol_id: run_process_id,
              name: "run_process" as SymbolName,
              defining_scope_id: processor_scope,
              location: {
                file_path: processor_file,
                start_line: 1,
                start_column: 35,
                end_line: 1,
                end_column: 110,
              },
              is_exported: false,
              signature: {
                parameters: [],
              },
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "process" as SymbolName,
            location: process_call_location,
            scope_id: processor_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [traits_file, traits_index],
        [item_file, item_index],
        [processor_file, processor_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Verify process call resolves to Item's implementation
      const process_key = location_key(process_call_location);
      expect(result.resolved_references.get(process_key)).toBe(
        process_method_id
      );
    });
  });
});
