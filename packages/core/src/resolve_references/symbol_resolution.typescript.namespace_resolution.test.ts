/**
 * Namespace Import Resolution Tests
 *
 * Tests resolution of namespace member access like `utils.helper()` where
 * `utils` is a namespace import (`import * as utils from './utils'`).
 *
 * Test Coverage:
 * - Basic namespace member access (single member)
 * - Multiple members on same namespace
 * - Namespace shadowing (local definition shadows namespace)
 * - Re-exported namespace members
 * - Missing namespaces and members (graceful failures)
 * - Language-specific patterns (JavaScript, TypeScript, Python, Rust)
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
  ImportDefinition,
  ModulePath,
  VariableDefinition,
  SymbolKind,
  AnyDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import { location_key } from "@ariadnejs/types";
import { create_test_index } from "./symbol_resolution.test";

// ============================================================================
// Namespace Import Resolution Tests
// ============================================================================

describe("Namespace Import Resolution", () => {
  describe("Basic Namespace Member Access", () => {
    it("resolves function call on namespace import", () => {
      // utils.ts: export function helper() {}
      // main.ts: import * as utils from './utils'; utils.helper();

      // Use absolute paths without extensions to match module resolver behavior
      const utils_file = "/tmp/utils" as FilePath;
      const utils_scope = "scope:/tmp/utils:module" as ScopeId;
      const helper_id = "function:/tmp/utils:helper:1:0" as SymbolId;

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
            } as LexicalScope,
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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 28,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        exported_symbols: new Map([
          [
            "helper" as SymbolName,
            {
              kind: "function",
              symbol_id: helper_id,
              name: "helper" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 28,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        references: [],
      });

      const main_file = "/tmp/main" as FilePath;
      const main_scope = "scope:/tmp/main:module" as ScopeId;
      const utils_import_id = "import:/tmp/main:utils:1:0" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 6,
        end_line: 2,
        end_column: 12,
      };

      const utils_import_def = {
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        scope_id: main_scope,
        defining_scope_id: main_scope,
        location: {
          file_path: main_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 35,
        },
        import_path: "./utils" as ModulePath,
        import_kind: "namespace",
      } as ImportDefinition;

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
                end_column: 20,
              },
              child_ids: [],
            } as LexicalScope,
          ],
        ]),
        imports_raw: new Map([
          [utils_import_id, utils_import_def],
        ]),
        scope_to_definitions_raw: new Map<ScopeId, ReadonlyMap<SymbolKind, AnyDefinition[]>>([
          [
            main_scope,
            new Map<SymbolKind, AnyDefinition[]>([
              ["import", [utils_import_def as AnyDefinition]],
            ]),
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "helper" as SymbolName,
            scope_id: main_scope,
            location: call_location,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 5,
              },
              property_chain: ["utils" as SymbolName, "helper" as SymbolName],
            },
          } as SymbolReference,
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const resolved = resolve_symbols(indices);
      const call_key = location_key(call_location);
      const resolved_symbol = resolved.resolved_references.get(call_key);

      expect(resolved_symbol).toBe(helper_id);
    });

    it("resolves class constructor on namespace import", () => {
      // utils.ts: export class Helper {}
      // main.ts: import * as utils from './utils'; new utils.Helper();

      const utils_file = "/tmp/utils" as FilePath;
      const utils_scope = "scope:/tmp/utils:module" as ScopeId;
      const helper_class_id = "class:/tmp/utils:Helper:1:0" as SymbolId;

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
            } as LexicalScope,
          ],
        ]),
        classes_raw: new Map([
          [
            helper_class_id,
            {
              kind: "class",
              symbol_id: helper_class_id,
              name: "Helper" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 24,
              },
              methods: [],
              properties: [],
              constructor: [],
              is_exported: true,
              export: {
                exported_name: "Helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              extends: [],
              decorators: [],
            } as ClassDefinition,
          ],
        ]),
        exported_symbols: new Map([
          [
            "Helper" as SymbolName,
            {
              kind: "class",
              symbol_id: helper_class_id,
              name: "Helper" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 24,
              },
              methods: [],
              properties: [],
              constructor: [],
              is_exported: true,
              export: {
                exported_name: "Helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              extends: [],
              decorators: [],
            } as ClassDefinition,
          ],
        ]),
        references: [],
      });

      const main_file = "/tmp/main" as FilePath;
      const main_scope = "scope:/tmp/main:module" as ScopeId;
      const utils_import_id = "import:/tmp/main:utils:1:0" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 10,
        end_line: 2,
        end_column: 16,
      };

      const utils_import_def = {
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        scope_id: main_scope,
        defining_scope_id: main_scope,
        location: {
          file_path: main_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 35,
        },
        import_path: "./utils" as ModulePath,
        import_kind: "namespace",
      } as ImportDefinition;

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
            } as LexicalScope,
          ],
        ]),
        imports_raw: new Map([
          [utils_import_id, utils_import_def],
        ]),
        scope_to_definitions_raw: new Map<ScopeId, ReadonlyMap<SymbolKind, AnyDefinition[]>>([
          [
            main_scope,
            new Map<SymbolKind, AnyDefinition[]>([
              ["import", [utils_import_def as AnyDefinition]],
            ]),
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "constructor",
            name: "Helper" as SymbolName,
            scope_id: main_scope,
            location: call_location,
            context: {
              construct_target: {
                file_path: main_file,
                start_line: 2,
                start_column: 4,
                end_line: 2,
                end_column: 16,
              },
              property_chain: ["utils" as SymbolName, "Helper" as SymbolName],
            },
          } as SymbolReference,
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const resolved = resolve_symbols(indices);
      const call_key = location_key(call_location);
      const resolved_symbol = resolved.resolved_references.get(call_key);

      expect(resolved_symbol).toBe(helper_class_id);
    });
  });

  describe("Multiple Namespace Members", () => {
    it("resolves multiple members on same namespace", () => {
      // utils.ts: export function a() {} export function b() {}
      // main.ts: import * as utils from './utils'; utils.a(); utils.b();

      const utils_file = "/tmp/utils" as FilePath;
      const utils_scope = "scope:/tmp/utils:module" as ScopeId;
      const func_a_id = "function:/tmp/utils:a:1:0" as SymbolId;
      const func_b_id = "function:/tmp/utils:b:2:0" as SymbolId;

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
                end_line: 2,
                end_column: 30,
              },
              child_ids: [],
            } as LexicalScope,
          ],
        ]),
        functions_raw: new Map([
          [
            func_a_id,
            {
              kind: "function",
              symbol_id: func_a_id,
              name: "a" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 24,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "a" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
          [
            func_b_id,
            {
              kind: "function",
              symbol_id: func_b_id,
              name: "b" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 24,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "b" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        exported_symbols: new Map([
          [
            "a" as SymbolName,
            {
              kind: "function",
              symbol_id: func_a_id,
              name: "a" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 24,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "a" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
          [
            "b" as SymbolName,
            {
              kind: "function",
              symbol_id: func_b_id,
              name: "b" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 24,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "b" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        references: [],
      });

      const main_file = "/tmp/main" as FilePath;
      const main_scope = "scope:/tmp/main:module" as ScopeId;
      const utils_import_id = "import:/tmp/main:utils:1:0" as SymbolId;
      const call_a_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 6,
        end_line: 2,
        end_column: 7,
      };
      const call_b_location = {
        file_path: main_file,
        start_line: 3,
        start_column: 6,
        end_line: 3,
        end_column: 7,
      };

      const utils_import_def = {
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        scope_id: main_scope,
        defining_scope_id: main_scope,
        location: {
          file_path: main_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 35,
        },
        import_path: "./utils" as ModulePath,
        import_kind: "namespace",
      } as ImportDefinition;

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
                end_column: 15,
              },
              child_ids: [],
            } as LexicalScope,
          ],
        ]),
        imports_raw: new Map([
          [utils_import_id, utils_import_def],
        ]),
        scope_to_definitions_raw: new Map<ScopeId, ReadonlyMap<SymbolKind, AnyDefinition[]>>([
          [
            main_scope,
            new Map<SymbolKind, AnyDefinition[]>([
              ["import", [utils_import_def as AnyDefinition]],
            ]),
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "a" as SymbolName,
            scope_id: main_scope,
            location: call_a_location,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 5,
              },
              property_chain: ["utils" as SymbolName, "a" as SymbolName],
            },
          } as SymbolReference,
          {
            type: "call",
            call_type: "method",
            name: "b" as SymbolName,
            scope_id: main_scope,
            location: call_b_location,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 3,
                start_column: 0,
                end_line: 3,
                end_column: 5,
              },
              property_chain: ["utils" as SymbolName, "b" as SymbolName],
            },
          } as SymbolReference,
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const resolved = resolve_symbols(indices);

      const call_a_key = location_key(call_a_location);
      const call_b_key = location_key(call_b_location);

      expect(resolved.resolved_references.get(call_a_key)).toBe(func_a_id);
      expect(resolved.resolved_references.get(call_b_key)).toBe(func_b_id);
    });
  });

  describe("Edge Cases", () => {
    it("returns null for missing namespace member", () => {
      // utils.ts: export function helper() {}
      // main.ts: import * as utils from './utils'; utils.missing();

      const utils_file = "/tmp/utils" as FilePath;
      const utils_scope = "scope:/tmp/utils:module" as ScopeId;
      const helper_id = "function:/tmp/utils:helper:1:0" as SymbolId;

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
            } as LexicalScope,
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
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 28,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        exported_symbols: new Map([
          [
            "helper" as SymbolName,
            {
              kind: "function",
              symbol_id: helper_id,
              name: "helper" as SymbolName,
              scope_id: utils_scope,
              defining_scope_id: utils_scope,
              location: {
                file_path: utils_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 28,
              },
              parameters: [],
              is_exported: true,
              export: {
                exported_name: "helper" as SymbolName,
                is_default: false,
                is_reexport: false,
              },
              signature: {
                parameters: [],
              },
            } as FunctionDefinition,
          ],
        ]),
        references: [],
      });

      const main_file = "/tmp/main" as FilePath;
      const main_scope = "scope:/tmp/main:module" as ScopeId;
      const utils_import_id = "import:/tmp/main:utils:1:0" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 6,
        end_line: 2,
        end_column: 13,
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
                end_column: 20,
              },
              child_ids: [],
            } as LexicalScope,
          ],
        ]),
        imports_raw: new Map([
          [
            utils_import_id,
            {
              kind: "import",
              symbol_id: utils_import_id,
              name: "utils" as SymbolName,
              scope_id: main_scope,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 0,
                end_line: 1,
                end_column: 35,
              },
              import_path: "./utils" as ModulePath,
              import_kind: "namespace",
            } as ImportDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "missing" as SymbolName,
            scope_id: main_scope,
            location: call_location,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 5,
              },
              property_chain: ["utils" as SymbolName, "missing" as SymbolName],
            },
          } as SymbolReference,
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [utils_file, utils_index],
        [main_file, main_index],
      ]);

      const resolved = resolve_symbols(indices);
      const call_key = location_key(call_location);
      const resolved_symbol = resolved.resolved_references.get(call_key);

      expect(resolved_symbol).toBeUndefined();
    });

    it("returns null for non-namespace symbol member access", () => {
      // main.ts: const utils = {}; utils.helper();
      // Should not resolve because utils is not a namespace import

      const main_file = "main.ts" as FilePath;
      const main_scope = "scope:main.ts:module" as ScopeId;
      const utils_var_id = "variable:/tmp/main:utils:1:0" as SymbolId;
      const call_location = {
        file_path: main_file,
        start_line: 2,
        start_column: 6,
        end_line: 2,
        end_column: 12,
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
                end_column: 20,
              },
              child_ids: [],
            } as LexicalScope,
          ],
        ]),
        variables_raw: new Map([
          [
            utils_var_id,
            {
              kind: "variable",
              symbol_id: utils_var_id,
              name: "utils" as SymbolName,
              scope_id: main_scope,
              defining_scope_id: main_scope,
              location: {
                file_path: main_file,
                start_line: 1,
                start_column: 6,
                end_line: 1,
                end_column: 11,
              },
              is_exported: false,
              signature: {
                parameters: [],
              },
            } as VariableDefinition,
          ],
        ]),
        references: [
          {
            type: "call",
            call_type: "method",
            name: "helper" as SymbolName,
            scope_id: main_scope,
            location: call_location,
            context: {
              receiver_location: {
                file_path: main_file,
                start_line: 2,
                start_column: 0,
                end_line: 2,
                end_column: 5,
              },
              property_chain: ["utils" as SymbolName, "helper" as SymbolName],
            },
          } as SymbolReference,
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        [main_file, main_index],
      ]);

      const resolved = resolve_symbols(indices);
      const call_key = location_key(call_location);
      const resolved_symbol = resolved.resolved_references.get(call_key);

      // Should be undefined because utils is not a namespace and has no type
      expect(resolved_symbol).toBeUndefined();
    });
  });
});
