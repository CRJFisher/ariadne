/**
 * Python Integration Tests for Symbol Resolution
 *
 * Tests Python-specific features: relative imports, packages,
 * self parameter, decorators, and Python module resolution
 *
 * Test Coverage:
 * - Module imports (from ... import, import ...)
 * - Class method resolution (instance methods, class methods, static methods)
 * - Decorator resolution (@decorator on functions/classes)
 * - Async/await function calls
 * - Property resolution (@property decorators)
 * - Dunder methods (__init__, __call__)
 * - Inheritance and super() calls
 * - Package imports (multi-level modules)
 * - Relative imports (., .., ...)
 *
 * ## Current Test Status
 *
 * **Test Results:** 1 passing | 13 todo
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
 *    - Tests: Imported functions, relative imports, package imports, class imports
 *
 * 2. **Method Call Resolution** (4 tests)
 *    - Requires: TypeContext integration for method lookup via receiver types
 *    - Tests: Instance methods, class methods, static methods
 *
 * 3. **Inheritance Resolution** (1 test)
 *    - Requires: Type inheritance tracking and method resolution order
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
  ModulePath,
  DecoratorDefinition,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import {
  resolve_symbols_with_registries,
  create_test_index,
  build_file_tree,
} from "./symbol_resolution.test_helpers";

// ============================================================================
// Python Symbol Resolution Integration Tests
// ============================================================================

describe("Python Symbol Resolution Integration", () => {
  describe("Function Calls", () => {
    it("resolves local function call", () => {
      // Code: def helper(): return 42\ndef main(): helper()
      const file_path = "main.py" as FilePath;
      const module_scope = "scope:main.py:module" as ScopeId;
      const helper_id = "function:main.py:helper:1:0" as SymbolId;
      const call_location = {
        file_path,
        start_line: 2,
        start_column: 12,
        end_line: 2,
        end_column: 18,
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
                end_column: 20,
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
              is_exported: false,
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
              signature: { parameters: [] },
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

    it("resolves imported function call", () => {
      // helper.py: def process(): return 42
      const helper_file = "/tmp/ariadne-test/python/helper.py" as FilePath;
      const helper_scope =
        "scope:/tmp/ariadne-test/python/helper.py:module" as ScopeId;
      const process_id =
        "function:/tmp/ariadne-test/python/helper.py:process:1:0" as SymbolId;

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
                end_column: 25,
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
              is_exported: true,
              symbol_id: process_id,
              name: "process" as SymbolName,
              defining_scope_id: helper_scope,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 25,
              },
              signature: { parameters: [] },
            },
          ],
        ]),
      });

      // main.py: from helper import process\nprocess()
      const main_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const main_scope =
        "scope:/tmp/ariadne-test/python/main.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/main.py:process:1:19" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 0,
        end_line: 2,
        end_column: 7,
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
                end_column: 9,
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
              is_exported: false,
              symbol_id: import_id,
              name: "process" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 19,
                end_line: 1,
                end_column: 26,
              },
              import_path: "helper" as ModulePath,
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
        [helper_file, helper_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(process_id);
    });

    it("resolves function from relative import", () => {
      // utils/helper.py: def process(): return 42
      const helper_file =
        "/tmp/ariadne-test/python/utils/helper.py" as FilePath;
      const helper_scope =
        "scope:/tmp/ariadne-test/python/utils/helper.py:module" as ScopeId;
      const process_id =
        "function:/tmp/ariadne-test/python/utils/helper.py:process:1:0" as SymbolId;

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
                end_column: 25,
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
              is_exported: true,
              symbol_id: process_id,
              name: "process" as SymbolName,
              defining_scope_id: helper_scope,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 25,
              },
              signature: { parameters: [] },
            },
          ],
        ]),
      });

      // utils/worker.py: from .helper import process\ndef work(): return process()
      const worker_file =
        "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const worker_scope =
        "scope:/tmp/ariadne-test/python/utils/worker.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/utils/worker.py:process:1:22" as SymbolId;
      const call_location = {
        file_path: worker_file,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 26,
      };

      const worker_index = create_test_index(worker_file, {
        root_scope_id: worker_scope,
        scopes_raw: new Map([
          [
            worker_scope,
            {
              id: worker_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: worker_file,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 28,
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
              is_exported: false,
              symbol_id: import_id,
              name: "process" as SymbolName,
              defining_scope_id: worker_scope,
              location: {
                file_path: worker_file,
                start_line: 1,
                start_column: 22,
                end_line: 1,
                end_column: 29,
              },
              import_path: ".helper" as ModulePath,
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
            scope_id: worker_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [helper_file, helper_index],
        [worker_file, worker_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(process_id);
    });
  });

  describe("Method Calls", () => {
    // TODO: Requires cross-file import resolution and type tracking
    it.todo("resolves method call with self parameter", () => {
      // user.py: class User:\n  def __init__(self, name): self.name = name\n  def get_name(self): return self.name
      const user_file = "user.py" as FilePath;
      const user_scope = "scope:user.py:module" as ScopeId;
      const user_class_id = "class:user.py:User:1:0" as SymbolId;
      const get_name_method_id = "method:user.py:User:get_name:3:2" as SymbolId;

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
                end_line: 3,
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
              is_exported: false,
              symbol_id: user_class_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 30,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: get_name_method_id,
                  name: "get_name" as SymbolName,
                  defining_scope_id: user_scope,
                  location: {
                    file_path: user_file,
                    start_line: 3,
                    start_column: 2,
                    end_line: 3,
                    end_column: 30,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            user_class_id,
            {
              methods: new Map([
                ["get_name" as SymbolName, get_name_method_id],
              ]),
              properties: new Map(),
              constructor: undefined,
              extends: [] as readonly SymbolName[],
            },
          ],
        ]),
      });

      // main.py: from user import User\ndef main():\n  user = User("Alice")\n  name = user.get_name()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const import_id = "import:main.py:User:1:17" as SymbolId;
      const user_var_id = "variable:main.py:user:3:2" as SymbolId;
      const constructor_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 9,
        end_line: 3,
        end_column: 21,
      };
      const method_call_location = {
        file_path: main_file,
        start_line: 4,
        start_column: 9,
        end_line: 4,
        end_column: 24,
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
                end_line: 4,
                end_column: 26,
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
              is_exported: false,
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
              import_path: "user.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        variables_raw: new Map([
          [
            user_var_id,
            {
              kind: "variable",
              is_exported: false,
              symbol_id: user_var_id,
              name: "user" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 3,
                start_column: 2,
                end_line: 3,
                end_column: 6,
              },
            },
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: main_file,
              start_line: 3,
              start_column: 2,
              end_line: 3,
              end_column: 6,
            }),
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
            context: {},
          },
          {
            type: "call",
            call_type: "method",
            name: "get_name" as SymbolName,
            location: method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 4,
                start_column: 9,
                end_line: 4,
                end_column: 13,
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

      // Verify constructor call
      const constructor_key = location_key(constructor_call_location);
      expect(result.resolved_references.get(constructor_key)).toBe(
        user_class_id
      );

      // Verify method call
      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        get_name_method_id
      );
    });

    // TODO: Requires cross-file import resolution and type tracking
    it.todo("resolves method call on instance variable", () => {
      // service.py: class Service:\n  def process(self): return True
      const service_file = "service.py" as FilePath;
      const service_scope = "scope:service.py:module" as ScopeId;
      const service_class_id = "class:service.py:Service:1:0" as SymbolId;
      const process_method_id =
        "method:service.py:Service:process:2:2" as SymbolId;

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
                end_line: 2,
                end_column: 30,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            service_class_id,
            {
              kind: "class",
              is_exported: false,
              symbol_id: service_class_id,
              name: "Service" as SymbolName,
              defining_scope_id: service_scope,
              location: {
                file_path: service_file,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 30,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: process_method_id,
                  name: "process" as SymbolName,
                  defining_scope_id: service_scope,
                  location: {
                    file_path: service_file,
                    start_line: 2,
                    start_column: 2,
                    end_line: 2,
                    end_column: 30,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            service_class_id,
            {
              methods: new Map([["process" as SymbolName, process_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [] as readonly SymbolName[],
            },
          ],
        ]),
      });

      // main.py: from service import Service\nsvc = Service()\nresult = svc.process()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const import_id = "import:main.py:Service:1:21" as SymbolId;
      const svc_var_id = "variable:main.py:svc:2:0" as SymbolId;
      const method_call_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 9,
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
              is_exported: false,
              symbol_id: import_id,
              name: "Service" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 21,
                end_line: 1,
                end_column: 28,
              },
              import_path: "service.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        variables_raw: new Map([
          [
            svc_var_id,
            {
              kind: "variable",
              is_exported: false,
              symbol_id: svc_var_id,
              name: "svc" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 3,
              },
            },
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: main_file,
              start_line: 2,
              start_column: 0,
              end_line: 2,
              end_column: 3,
            }),
            "Service" as SymbolName,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "process" as SymbolName,
            location: method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 3,
                start_column: 9,
                end_line: 3,
                end_column: 12,
              },
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [service_file, service_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        process_method_id
      );
    });

    // TODO: Requires cross-file import resolution and class method tracking
    it.todo("resolves class method (@classmethod)", () => {
      // config.py: class Config:\n  @classmethod\n  def load(cls): return Config()
      const config_file = "config.py" as FilePath;
      const config_scope = "scope:config.py:module" as ScopeId;
      const config_class_id = "class:config.py:Config:1:0" as SymbolId;
      const load_method_id = "method:config.py:Config:load:3:2" as SymbolId;

      const config_index = create_test_index(config_file, {
        root_scope_id: config_scope,
        scopes_raw: new Map([
          [
            config_scope,
            {
              id: config_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: config_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 30,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            config_class_id,
            {
              kind: "class",
              is_exported: false,
              symbol_id: config_class_id,
              name: "Config" as SymbolName,
              defining_scope_id: config_scope,
              location: {
                file_path: config_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 30,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: load_method_id,
                  name: "load" as SymbolName,
                  defining_scope_id: config_scope,
                  location: {
                    file_path: config_file,
                    start_line: 3,
                    start_column: 2,
                    end_line: 3,
                    end_column: 30,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            config_class_id,
            {
              methods: new Map([["load" as SymbolName, load_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [] as readonly SymbolName[],
            },
          ],
        ]),
      });

      // main.py: from config import Config\nconfig = Config.load()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const import_id = "import:main.py:Config:1:20" as SymbolId;
      const method_call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 9,
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
              is_exported: false,
              symbol_id: import_id,
              name: "Config" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 20,
                end_line: 1,
                end_column: 26,
              },
              import_path: "config.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "load" as SymbolName,
            location: method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 9,
                end_line: 2,
                end_column: 15,
              },
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [config_file, config_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(load_method_id);
    });

    // TODO: Requires cross-file import resolution and static method tracking
    it.todo("resolves static method (@staticmethod)", () => {
      // config.py: class Config:\n  @staticmethod\n  def validate(): return True
      const config_file = "config.py" as FilePath;
      const config_scope = "scope:config.py:module" as ScopeId;
      const config_class_id = "class:config.py:Config:1:0" as SymbolId;
      const validate_method_id =
        "method:config.py:Config:validate:3:2" as SymbolId;

      const config_index = create_test_index(config_file, {
        root_scope_id: config_scope,
        scopes_raw: new Map([
          [
            config_scope,
            {
              id: config_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: config_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 30,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            config_class_id,
            {
              kind: "class",
              is_exported: false,
              symbol_id: config_class_id,
              name: "Config" as SymbolName,
              defining_scope_id: config_scope,
              location: {
                file_path: config_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 30,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: validate_method_id,
                  name: "validate" as SymbolName,
                  defining_scope_id: config_scope,
                  location: {
                    file_path: config_file,
                    start_line: 3,
                    start_column: 2,
                    end_line: 3,
                    end_column: 30,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            config_class_id,
            {
              methods: new Map([
                ["validate" as SymbolName, validate_method_id],
              ]),
              properties: new Map(),
              constructor: undefined,
              extends: [] as readonly SymbolName[],
            },
          ],
        ]),
      });

      // main.py: from config import Config\nvalid = Config.validate()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const import_id = "import:main.py:Config:1:20" as SymbolId;
      const method_call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 8,
        end_line: 2,
        end_column: 24,
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
                end_column: 26,
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
              is_exported: false,
              symbol_id: import_id,
              name: "Config" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 20,
                end_line: 1,
                end_column: 26,
              },
              import_path: "config.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "validate" as SymbolName,
            location: method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 8,
                end_line: 2,
                end_column: 14,
              },
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [config_file, config_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const method_key = location_key(method_call_location);
      expect(result.resolved_references.get(method_key)).toBe(
        validate_method_id
      );
    });
  });

  describe("Relative Imports", () => {
    // TODO: Requires cross-file import resolution with relative paths
    it("resolves single-dot relative import (same directory)", () => {
      // utils/helper.py: def process(): return 42
      const helper_file =
        "/tmp/ariadne-test/python/utils/helper.py" as FilePath;
      const helper_scope =
        "scope:/tmp/ariadne-test/python/utils/helper.py:module" as ScopeId;
      const process_id =
        "function:/tmp/ariadne-test/python/utils/helper.py:process:1:0" as SymbolId;

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
                end_column: 25,
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
              is_exported: true,
              symbol_id: process_id,
              name: "process" as SymbolName,
              defining_scope_id: helper_scope,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 25,
              },
              signature: { parameters: [] },
            },
          ],
        ]),
      });

      // utils/worker.py: from .helper import process\ndef work(): return process()
      const worker_file =
        "/tmp/ariadne-test/python/utils/worker.py" as FilePath;
      const worker_scope =
        "scope:/tmp/ariadne-test/python/utils/worker.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/utils/worker.py:process:1:22" as SymbolId;
      const call_location = {
        file_path: worker_file,
        start_line: 2,
        start_column: 19,
        end_line: 2,
        end_column: 26,
      };

      const worker_index = create_test_index(worker_file, {
        root_scope_id: worker_scope,
        scopes_raw: new Map([
          [
            worker_scope,
            {
              id: worker_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: worker_file,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 28,
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
              is_exported: false,
              symbol_id: import_id,
              name: "process" as SymbolName,
              defining_scope_id: worker_scope,
              location: {
                file_path: worker_file,
                start_line: 1,
                start_column: 22,
                end_line: 1,
                end_column: 29,
              },
              import_path: ".helper" as ModulePath,
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
            scope_id: worker_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [helper_file, helper_index],
        [worker_file, worker_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(process_id);
    });

    // TODO: Requires cross-file import resolution with parent directory paths
    it("resolves double-dot relative import (parent directory)", () => {
      // models/user.py: class User: pass
      const user_file = "/tmp/ariadne-test/python/models/user.py" as FilePath;
      const user_scope =
        "scope:/tmp/ariadne-test/python/models/user.py:module" as ScopeId;
      const user_class_id =
        "class:/tmp/ariadne-test/python/models/user.py:User:1:0" as SymbolId;

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
                end_column: 16,
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
              is_exported: true,
              symbol_id: user_class_id,
              name: "User" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 16,
              },
              methods: [],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
      });

      // services/user_service.py: from ..models.user import User\nclass UserService:\n  def create_user(self): return User()
      const service_file =
        "/tmp/ariadne-test/python/services/user_service.py" as FilePath;
      const service_scope =
        "scope:/tmp/ariadne-test/python/services/user_service.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/services/user_service.py:User:1:30" as SymbolId;
      const user_call_location = {
        file_path: service_file,
        start_line: 3,
        start_column: 31,
        end_line: 3,
        end_column: 37,
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
                end_line: 3,
                end_column: 39,
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
              is_exported: false,
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
              import_path: "..models.user" as ModulePath,
              import_kind: "named",
              original_name: undefined,
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
            context: {},
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
      expect(result.resolved_references.get(call_key)).toBe(user_class_id);
    });

    // TODO: Requires cross-file import resolution with multi-level paths
    it.todo("resolves multi-level relative import", () => {
      // shared/base/model.py: class BaseModel: pass
      const model_file =
        "/tmp/ariadne-test/python/shared/base/model.py" as FilePath;
      const model_scope =
        "scope:/tmp/ariadne-test/python/shared/base/model.py:module" as ScopeId;
      const base_model_id =
        "class:/tmp/ariadne-test/python/shared/base/model.py:BaseModel:1:0" as SymbolId;

      const model_index = create_test_index(model_file, {
        root_scope_id: model_scope,
        scopes_raw: new Map([
          [
            model_scope,
            {
              id: model_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: model_file,
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
            base_model_id,
            {
              kind: "class",
              is_exported: true,
              symbol_id: base_model_id,
              name: "BaseModel" as SymbolName,
              defining_scope_id: model_scope,
              location: {
                file_path: model_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 21,
              },
              methods: [],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
      });

      // app/models/user.py: from ...shared.base.model import BaseModel\nclass User(BaseModel): pass
      const user_file =
        "/tmp/ariadne-test/python/app/models/user.py" as FilePath;
      const user_scope =
        "scope:/tmp/ariadne-test/python/app/models/user.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/app/models/user.py:BaseModel:1:38" as SymbolId;
      const base_call_location = {
        file_path: user_file,
        start_line: 2,
        start_column: 11,
        end_line: 2,
        end_column: 20,
      };

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
                end_line: 2,
                end_column: 27,
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
              is_exported: false,
              symbol_id: import_id,
              name: "BaseModel" as SymbolName,
              defining_scope_id: user_scope,
              location: {
                file_path: user_file,
                start_line: 1,
                start_column: 38,
                end_line: 1,
                end_column: 47,
              },
              import_path: "...shared.base.model" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "type",
            name: "BaseModel" as SymbolName,
            location: base_call_location,
            scope_id: user_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [model_file, model_index],
        [user_file, user_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(base_call_location);
      expect(result.resolved_references.get(call_key)).toBe(base_model_id);
    });
  });

  describe("Package Imports", () => {
    // TODO: Requires cross-file import resolution through __init__.py
    it.todo("resolves import from __init__.py", () => {
      // utils/helper.py: def helper_function(): return 42
      const helper_file = "utils/helper.py" as FilePath;
      const helper_scope = "scope:utils/helper.py:module" as ScopeId;
      const helper_func_id =
        "function:utils/helper.py:helper_function:1:0" as SymbolId;

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
                end_column: 38,
              },
              child_ids: [],
            },
          ],
        ]),
        functions_raw: new Map([
          [
            helper_func_id,
            {
              kind: "function",
              is_exported: false,
              symbol_id: helper_func_id,
              name: "helper_function" as SymbolName,
              defining_scope_id: helper_scope,
              location: {
                file_path: helper_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 38,
              },
              signature: { parameters: [] },
            },
          ],
        ]),
      });

      // utils/__init__.py: from .helper import helper_function
      const init_file = "utils/__init__.py" as FilePath;
      const init_scope = "scope:utils/__init__.py:module" as ScopeId;
      const init_import_id =
        "import:utils/__init__.py:helper_function:1:22" as SymbolId;

      const init_index = create_test_index(init_file, {
        root_scope_id: init_scope,
        scopes_raw: new Map([
          [
            init_scope,
            {
              id: init_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: init_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 40,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            init_import_id,
            {
              kind: "import",
              is_exported: false,
              symbol_id: init_import_id,
              name: "helper_function" as SymbolName,
              defining_scope_id: init_scope,
              location: {
                file_path: init_file,
                start_line: 1,
                start_column: 22,
                end_line: 1,
                end_column: 37,
              },
              import_path: "utils/helper.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
      });

      // main.py: from utils import helper_function\ndef main(): helper_function()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const main_import_id = "import:main.py:helper_function:1:18" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 12,
        end_line: 2,
        end_column: 27,
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
                end_column: 29,
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
              is_exported: false,
              symbol_id: main_import_id,
              name: "helper_function" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 18,
                end_line: 1,
                end_column: 33,
              },
              import_path: "utils/__init__.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "function",
            name: "helper_function" as SymbolName,
            location: call_location,
            scope_id: main_scope,
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [helper_file, helper_index],
        [init_file, init_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(helper_func_id);
    });

    // TODO: Requires cross-file import resolution for nested packages
    it("resolves nested package import", () => {
      // app/services/auth/handler.py: class AuthHandler: pass
      const handler_file =
        "/tmp/ariadne-test/python/app/services/auth/handler.py" as FilePath;
      const handler_scope =
        "scope:/tmp/ariadne-test/python/app/services/auth/handler.py:module" as ScopeId;
      const auth_handler_id =
        "class:/tmp/ariadne-test/python/app/services/auth/handler.py:AuthHandler:1:0" as SymbolId;

      const handler_index = create_test_index(handler_file, {
        root_scope_id: handler_scope,
        scopes_raw: new Map([
          [
            handler_scope,
            {
              id: handler_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: handler_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 23,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            auth_handler_id,
            {
              kind: "class",
              is_exported: true,
              symbol_id: auth_handler_id,
              name: "AuthHandler" as SymbolName,
              defining_scope_id: handler_scope,
              location: {
                file_path: handler_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 23,
              },
              methods: [],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
      });

      // main.py: from app.services.auth.handler import AuthHandler\nhandler = AuthHandler()
      const main_file = "/tmp/ariadne-test/python/main.py" as FilePath;
      const main_scope =
        "scope:/tmp/ariadne-test/python/main.py:module" as ScopeId;
      const import_id =
        "import:/tmp/ariadne-test/python/main.py:AuthHandler:1:43" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 10,
        end_line: 2,
        end_column: 23,
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
                end_column: 25,
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
              is_exported: false,
              symbol_id: import_id,
              name: "AuthHandler" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 43,
                end_line: 1,
                end_column: 54,
              },
              import_path: "app.services.auth.handler" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "AuthHandler" as SymbolName,
            location: call_location,
            scope_id: main_scope,
            context: {},
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [handler_file, handler_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      const call_key = location_key(call_location);
      expect(result.resolved_references.get(call_key)).toBe(auth_handler_id);
    });
  });

  describe("Complex Scenarios", () => {
    // TODO: Requires cross-file import resolution and type tracking
    it.todo(
      "resolves full workflow: import → instantiate → method call",
      () => {
        // models/user.py
        const user_file = "models/user.py" as FilePath;
        const user_scope = "scope:models/user.py:module" as ScopeId;
        const user_class_id = "class:models/user.py:User:1:0" as SymbolId;
        const get_name_method_id =
          "method:models/user.py:User:get_name:3:2" as SymbolId;

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
                  end_line: 3,
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
                is_exported: false,
                symbol_id: user_class_id,
                name: "User" as SymbolName,
                defining_scope_id: user_scope,
                location: {
                  file_path: user_file,
                  start_line: 1,
                  start_column: 0,
                  end_line: 3,
                  end_column: 30,
                },
                methods: [
                  {
                    kind: "method",
                    is_exported: false,
                    symbol_id: get_name_method_id,
                    name: "get_name" as SymbolName,
                    defining_scope_id: user_scope,
                    location: {
                      file_path: user_file,
                      start_line: 3,
                      start_column: 2,
                      end_line: 3,
                      end_column: 30,
                    },
                    parameters: [],
                  },
                ],
                extends: [] as readonly SymbolName[],
                decorators: [] as readonly DecoratorDefinition[],
                properties: [],
                constructor: undefined,
              },
            ],
          ]),
          type_members_raw: new Map([
            [
              user_class_id,
              {
                methods: new Map([
                  ["get_name" as SymbolName, get_name_method_id],
                ]),
                properties: new Map(),
                constructor: undefined,
                extends: [] as readonly SymbolName[],
              },
            ],
          ]),
        });

        // repositories/user_repository.py
        const repository_file = "repositories/user_repository.py" as FilePath;
        const repository_scope =
          "scope:repositories/user_repository.py:module" as ScopeId;
        const repo_class_id =
          "class:repositories/user_repository.py:UserRepository:2:0" as SymbolId;
        const create_user_method_id =
          "method:repositories/user_repository.py:UserRepository:create_user:4:2" as SymbolId;

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
                  end_line: 5,
                  end_column: 30,
                },
                child_ids: [],
              },
            ],
          ]),
          imports_raw: new Map([
            [
              "import:repositories/user_repository.py:User:1:26" as SymbolId,
              {
                kind: "import",
                is_exported: false,
                symbol_id:
                  "import:repositories/user_repository.py:User:1:26" as SymbolId,
                name: "User" as SymbolName,
                defining_scope_id: repository_scope,
                location: {
                  file_path: repository_file,
                  start_line: 1,
                  start_column: 26,
                  end_line: 1,
                  end_column: 30,
                },
                import_path: "models/user.py" as ModulePath,
                import_kind: "named",
                original_name: undefined,
              },
            ],
          ]),
          classes_raw: new Map([
            [
              repo_class_id,
              {
                kind: "class",
                is_exported: false,
                symbol_id: repo_class_id,
                name: "UserRepository" as SymbolName,
                defining_scope_id: repository_scope,
                location: {
                  file_path: repository_file,
                  start_line: 2,
                  start_column: 0,
                  end_line: 5,
                  end_column: 30,
                },
                methods: [
                  {
                    kind: "method",
                    is_exported: false,
                    symbol_id: create_user_method_id,
                    name: "create_user" as SymbolName,
                    defining_scope_id: repository_scope,
                    location: {
                      file_path: repository_file,
                      start_line: 4,
                      start_column: 2,
                      end_line: 5,
                      end_column: 30,
                    },
                    parameters: [],
                  },
                ],
                extends: [] as readonly SymbolName[],
                decorators: [] as readonly DecoratorDefinition[],
                properties: [],
                constructor: undefined,
              },
            ],
          ]),
          type_members_raw: new Map([
            [
              repo_class_id,
              {
                methods: new Map([
                  ["create_user" as SymbolName, create_user_method_id],
                ]),
                properties: new Map(),
                constructor: undefined,
                extends: [] as readonly SymbolName[],
              },
            ],
          ]),
          references: [
            {
              type: "call",
              call_type: "constructor",
              name: "User" as SymbolName,
              location: {
                file_path: repository_file,
                start_line: 5,
                start_column: 15,
                end_line: 5,
                end_column: 25,
              },
              scope_id: repository_scope,
              context: {},
            },
          ],
        });

        // services/user_service.py
        const service_file = "services/user_service.py" as FilePath;
        const service_scope =
          "scope:services/user_service.py:module" as ScopeId;
        const service_class_id =
          "class:services/user_service.py:UserService:2:0" as SymbolId;
        const register_user_method_id =
          "method:services/user_service.py:UserService:register_user:5:2" as SymbolId;
        const repo_var_id =
          "variable:services/user_service.py:repo:4:4" as SymbolId;

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
                  end_line: 8,
                  end_column: 30,
                },
                child_ids: [],
              },
            ],
          ]),
          imports_raw: new Map([
            [
              "import:services/user_service.py:UserRepository:1:44" as SymbolId,
              {
                kind: "import",
                is_exported: false,
                symbol_id:
                  "import:services/user_service.py:UserRepository:1:44" as SymbolId,
                name: "UserRepository" as SymbolName,
                defining_scope_id: service_scope,
                location: {
                  file_path: service_file,
                  start_line: 1,
                  start_column: 44,
                  end_line: 1,
                  end_column: 58,
                },
                import_path: "repositories/user_repository.py" as ModulePath,
                import_kind: "named",
                original_name: undefined,
              },
            ],
          ]),
          classes_raw: new Map([
            [
              service_class_id,
              {
                kind: "class",
                is_exported: false,
                symbol_id: service_class_id,
                name: "UserService" as SymbolName,
                defining_scope_id: service_scope,
                location: {
                  file_path: service_file,
                  start_line: 2,
                  start_column: 0,
                  end_line: 8,
                  end_column: 30,
                },
                methods: [
                  {
                    kind: "method",
                    is_exported: false,
                    symbol_id: register_user_method_id,
                    name: "register_user" as SymbolName,
                    defining_scope_id: service_scope,
                    location: {
                      file_path: service_file,
                      start_line: 5,
                      start_column: 2,
                      end_line: 8,
                      end_column: 30,
                    },
                    parameters: [],
                  },
                ],
                extends: [] as readonly SymbolName[],
                decorators: [] as readonly DecoratorDefinition[],
                properties: [],
                constructor: undefined,
              },
            ],
          ]),
          variables_raw: new Map([
            [
              repo_var_id,
              {
                kind: "variable",
                is_exported: false,
                symbol_id: repo_var_id,
                name: "repo" as SymbolName,
                defining_scope_id: service_scope,
                location: {
                  file_path: service_file,
                  start_line: 4,
                  start_column: 4,
                  end_line: 4,
                  end_column: 8,
                },
              },
            ],
          ]),
          type_bindings_raw: new Map([
            [
              location_key({
                file_path: service_file,
                start_line: 4,
                start_column: 4,
                end_line: 4,
                end_column: 8,
              }),
              "UserRepository" as SymbolName,
            ],
          ]),
          type_members_raw: new Map([
            [
              service_class_id,
              {
                methods: new Map([
                  ["register_user" as SymbolName, register_user_method_id],
                ]),
                properties: new Map(),
                constructor: undefined,
                extends: [] as readonly SymbolName[],
              },
            ],
          ]),
          references: [
            {
              type: "call",
              call_type: "constructor",
              name: "UserRepository" as SymbolName,
              location: {
                file_path: service_file,
                start_line: 4,
                start_column: 17,
                end_line: 4,
                end_column: 33,
              },
              scope_id: service_scope,
              context: {},
            },
            {
              type: "call",
              call_type: "method",
              name: "create_user" as SymbolName,
              location: {
                file_path: service_file,
                start_line: 6,
                start_column: 11,
                end_line: 6,
                end_column: 33,
              },
              scope_id: service_scope,
              context: {
                receiver_location: {
                  file_path: service_file,
                  start_line: 6,
                  start_column: 11,
                  end_line: 6,
                  end_column: 15,
                },
              },
            },
            {
              type: "call",
              call_type: "method",
              name: "get_name" as SymbolName,
              location: {
                file_path: service_file,
                start_line: 8,
                start_column: 15,
                end_line: 8,
                end_column: 29,
              },
              scope_id: service_scope,
              context: {
                receiver_location: {
                  file_path: service_file,
                  start_line: 8,
                  start_column: 15,
                  end_line: 8,
                  end_column: 19,
                },
              },
            },
          ],
        });

        // main.py
        const main_file = "main.py" as FilePath;
        const main_scope = "scope:main.py:module" as ScopeId;
        const main_import_id = "import:main.py:UserService:1:32" as SymbolId;
        const service_var_id = "variable:main.py:service:3:0" as SymbolId;
        const service_constructor_location = {
          file_path: main_file,
          start_line: 3,
          start_column: 10,
          end_line: 3,
          end_column: 23,
        };
        const register_user_call_location = {
          file_path: main_file,
          start_line: 4,
          start_column: 7,
          end_line: 4,
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
                  end_line: 4,
                  end_column: 35,
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
                is_exported: false,
                symbol_id: main_import_id,
                name: "UserService" as SymbolName,
                defining_scope_id: main_scope,
                location: {
                  file_path: main_file,
                  start_line: 1,
                  start_column: 32,
                  end_line: 1,
                  end_column: 43,
                },
                import_path: "services/user_service.py" as ModulePath,
                import_kind: "named",
                original_name: undefined,
              },
            ],
          ]),
          variables_raw: new Map([
            [
              service_var_id,
              {
                kind: "variable",
                is_exported: false,
                symbol_id: service_var_id,
                name: "service" as SymbolName,
                defining_scope_id: main_scope,
                location: {
                  file_path: main_file,
                  start_line: 3,
                  start_column: 0,
                  end_line: 3,
                  end_column: 7,
                },
              },
            ],
          ]),
          type_bindings_raw: new Map([
            [
              location_key({
                file_path: main_file,
                start_line: 3,
                start_column: 0,
                end_line: 3,
                end_column: 7,
              }),
              "UserService" as SymbolName,
            ],
          ]),
          references: [
            {
              type: "call",
              call_type: "constructor",
              name: "UserService" as SymbolName,
              location: service_constructor_location,
              scope_id: main_scope,
              context: {},
            },
            {
              type: "call",
              call_type: "method",
              name: "register_user" as SymbolName,
              location: register_user_call_location,
              scope_id: main_scope,
              context: {
                receiver_location: {
                  file_path: main_file,
                  start_line: 4,
                  start_column: 7,
                  end_line: 4,
                  end_column: 14,
                },
              },
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

        // Verify UserService constructor in main.py
        const service_constructor_key = location_key(
          service_constructor_location
        );
        expect(result.resolved_references.get(service_constructor_key)).toBe(
          service_class_id
        );

        // Verify register_user method call in main.py
        const register_user_key = location_key(register_user_call_location);
        expect(result.resolved_references.get(register_user_key)).toBe(
          register_user_method_id
        );

        // Verify UserRepository constructor in user_service.py
        const repo_constructor_key = location_key({
          file_path: service_file,
          start_line: 4,
          start_column: 17,
          end_line: 4,
          end_column: 33,
        });
        expect(result.resolved_references.get(repo_constructor_key)).toBe(
          repo_class_id
        );

        // Verify create_user method call in user_service.py
        const create_user_key = location_key({
          file_path: service_file,
          start_line: 6,
          start_column: 11,
          end_line: 6,
          end_column: 33,
        });
        expect(result.resolved_references.get(create_user_key)).toBe(
          create_user_method_id
        );

        // Verify User constructor call in user_repository.py
        const user_constructor_key = location_key({
          file_path: repository_file,
          start_line: 5,
          start_column: 15,
          end_line: 5,
          end_column: 25,
        });
        expect(result.resolved_references.get(user_constructor_key)).toBe(
          user_class_id
        );
      }
    );

    // TODO: Requires cross-file import resolution and inheritance tracking
    it.todo("resolves method call through inheritance", () => {
      // base.py: class Base:\n  def base_method(self): return "base"
      const base_file = "base.py" as FilePath;
      const base_scope = "scope:base.py:module" as ScopeId;
      const base_class_id = "class:base.py:Base:1:0" as SymbolId;
      const base_method_id = "method:base.py:Base:base_method:2:2" as SymbolId;

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
                end_line: 2,
                end_column: 40,
              },
              child_ids: [],
            },
          ],
        ]),
        classes_raw: new Map([
          [
            base_class_id,
            {
              kind: "class",
              is_exported: false,
              symbol_id: base_class_id,
              name: "Base" as SymbolName,
              defining_scope_id: base_scope,
              location: {
                file_path: base_file,
                start_line: 1,
                start_column: 0,
                end_line: 2,
                end_column: 40,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: base_method_id,
                  name: "base_method" as SymbolName,
                  defining_scope_id: base_scope,
                  location: {
                    file_path: base_file,
                    start_line: 2,
                    start_column: 2,
                    end_line: 2,
                    end_column: 40,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            base_class_id,
            {
              methods: new Map([["base_method" as SymbolName, base_method_id]]),
              properties: new Map(),
              constructor: undefined,
              extends: [] as readonly SymbolName[],
            },
          ],
        ]),
      });

      // derived.py: from base import Base\nclass Derived(Base):\n  def derived_method(self): return self.base_method()
      const derived_file = "derived.py" as FilePath;
      const derived_scope = "scope:derived.py:module" as ScopeId;
      const derived_class_id = "class:derived.py:Derived:2:0" as SymbolId;
      const derived_method_id =
        "method:derived.py:Derived:derived_method:3:2" as SymbolId;

      const derived_index = create_test_index(derived_file, {
        root_scope_id: derived_scope,
        scopes_raw: new Map([
          [
            derived_scope,
            {
              id: derived_scope,
              type: "module",
              parent_id: null,
              name: null,
              location: {
                file_path: derived_file,
                start_line: 1,
                start_column: 0,
                end_line: 3,
                end_column: 50,
              },
              child_ids: [],
            },
          ],
        ]),
        imports_raw: new Map([
          [
            "import:derived.py:Base:1:17" as SymbolId,
            {
              kind: "import",
              is_exported: false,
              symbol_id: "import:derived.py:Base:1:17" as SymbolId,
              name: "Base" as SymbolName,
              defining_scope_id: derived_scope,
              location: {
                file_path: derived_file,
                start_line: 1,
                start_column: 17,
                end_line: 1,
                end_column: 21,
              },
              import_path: "base.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        classes_raw: new Map([
          [
            derived_class_id,
            {
              kind: "class",
              is_exported: false,
              symbol_id: derived_class_id,
              name: "Derived" as SymbolName,
              defining_scope_id: derived_scope,
              location: {
                file_path: derived_file,
                start_line: 2,
                start_column: 0,
                end_line: 3,
                end_column: 50,
              },
              methods: [
                {
                  kind: "method",
                  is_exported: false,
                  symbol_id: derived_method_id,
                  name: "derived_method" as SymbolName,
                  defining_scope_id: derived_scope,
                  location: {
                    file_path: derived_file,
                    start_line: 3,
                    start_column: 2,
                    end_line: 3,
                    end_column: 50,
                  },
                  parameters: [],
                },
              ],
              extends: [] as readonly SymbolName[],
              decorators: [] as readonly DecoratorDefinition[],
              properties: [],
              constructor: undefined,
            },
          ],
        ]),
        type_members_raw: new Map([
          [
            derived_class_id,
            {
              methods: new Map([
                ["derived_method" as SymbolName, derived_method_id],
              ]),
              properties: new Map(),
              constructor: undefined,
              extends: ["Base" as SymbolName],
            },
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "base_method" as SymbolName,
            location: {
              file_path: derived_file,
              start_line: 3,
              start_column: 33,
              end_line: 3,
              end_column: 49,
            },
            scope_id: derived_scope,
            context: {
              receiver_location: {
                file_path: derived_file,
                start_line: 3,
                start_column: 33,
                end_line: 3,
                end_column: 37,
              },
            },
          },
        ],
      });

      // main.py: from derived import Derived\ndef main():\n  obj = Derived()\n  obj.base_method()\n  obj.derived_method()
      const main_file = "main.py" as FilePath;
      const main_scope = "scope:main.py:module" as ScopeId;
      const import_id = "import:main.py:Derived:1:21" as SymbolId;
      const obj_var_id = "variable:main.py:obj:3:2" as SymbolId;
      const base_method_call_location = {
        file_path: main_file,
        start_line: 4,
        start_column: 2,
        end_line: 4,
        end_column: 19,
      };
      const derived_method_call_location = {
        file_path: main_file,
        start_line: 5,
        start_column: 2,
        end_line: 5,
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
                end_line: 5,
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
              is_exported: false,
              symbol_id: import_id,
              name: "Derived" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 21,
                end_line: 1,
                end_column: 28,
              },
              import_path: "derived.py" as ModulePath,
              import_kind: "named",
              original_name: undefined,
            },
          ],
        ]),
        variables_raw: new Map([
          [
            obj_var_id,
            {
              kind: "variable",
              is_exported: false,
              symbol_id: obj_var_id,
              name: "obj" as SymbolName,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 3,
                start_column: 2,
                end_line: 3,
                end_column: 5,
              },
            },
          ],
        ]),
        type_bindings_raw: new Map([
          [
            location_key({
              file_path: main_file,
              start_line: 3,
              start_column: 2,
              end_line: 3,
              end_column: 5,
            }),
            "Derived" as SymbolName,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "base_method" as SymbolName,
            location: base_method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 4,
                start_column: 2,
                end_line: 4,
                end_column: 5,
              },
            },
          },
          {
            type: "call",
            call_type: "method",
            name: "derived_method" as SymbolName,
            location: derived_method_call_location,
            scope_id: main_scope,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 5,
                start_column: 2,
                end_line: 5,
                end_column: 5,
              },
            },
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [base_file, base_index],
        [derived_file, derived_index],
        [main_file, main_index],
      ]);

      const root_folder = build_file_tree(Array.from(indices.keys()));
      const result = resolve_symbols_with_registries(indices, root_folder);

      // Verify base_method call in main.py resolves to Base.base_method
      const base_method_key = location_key(base_method_call_location);
      expect(result.resolved_references.get(base_method_key)).toBe(
        base_method_id
      );

      // Verify derived_method call in main.py resolves to Derived.derived_method
      const derived_method_key = location_key(derived_method_call_location);
      expect(result.resolved_references.get(derived_method_key)).toBe(
        derived_method_id
      );

      // Verify base_method call inside Derived class resolves to Base.base_method
      const base_method_in_derived_key = location_key({
        file_path: derived_file,
        start_line: 3,
        start_column: 33,
        end_line: 3,
        end_column: 49,
      });
      expect(result.resolved_references.get(base_method_in_derived_key)).toBe(
        base_method_id
      );
    });
  });
});
