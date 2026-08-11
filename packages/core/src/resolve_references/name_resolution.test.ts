/**
 * Unit Tests for Name Resolution (Phase 1)
 *
 * Tests the pure functions for resolving symbol names in scopes.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_names, type NameResolutionContext } from "./name_resolution";
import { DefinitionRegistry } from "./registries/definition";
import { ScopeRegistry } from "./registries/scope";
import { ExportRegistry } from "./registries/export";
import { ImportGraph } from "./import_resolution/import_graph";
import { function_symbol, namespace_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  FilePath,
  ScopeId,
  SymbolId,
  SymbolName,
  Location,
  FunctionDefinition,
  VariableDefinition,
  ImportDefinition,
  ModulePath,
  Language,
  LexicalScope,
  ScopeType,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";
import { create_module_resolution_context } from "./import_resolution";

const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const FUNC_SCOPE_ID = "scope:test.ts:greet:1:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

function make_scope(
  id: ScopeId,
  type: ScopeType,
  parent_id: ScopeId | null,
  child_ids: ScopeId[] = []
): LexicalScope {
  return {
    id,
    type,
    location: MOCK_LOCATION,
    parent_id,
    name: null,
    child_ids,
  } as LexicalScope;
}

function make_function(
  name: string,
  scope_id: ScopeId,
  symbol_id: SymbolId
): FunctionDefinition {
  return {
    kind: "function",
    symbol_id,
    name: name as SymbolName,
    defining_scope_id: scope_id,
    location: MOCK_LOCATION,
    signature: { parameters: [] },
    body_scope_id: `scope:test.ts:${name}:1:0` as ScopeId,
    is_exported: false,
  };
}

describe("resolve_names", () => {
  let definitions: DefinitionRegistry;
  let scopes: ScopeRegistry;
  let exports: ExportRegistry;
  let imports: ImportGraph;
  let context: NameResolutionContext;

  const mock_root_folder: FileSystemFolder = {
    path: "/" as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    scopes = new ScopeRegistry();
    exports = new ExportRegistry();
    imports = new ImportGraph();

    const languages = new Map<FilePath, Language>([[TEST_FILE, "typescript"]]);

    context = {
      languages,
      definitions,
      scopes,
      exports,
      imports,
      resolution: create_module_resolution_context(mock_root_folder),
    };
  });

  describe("Empty inputs", () => {
    it("returns empty result for empty file_ids", () => {
      const result = resolve_names(new Set(), context);

      expect(result.resolutions_by_scope.size).toBe(0);
      expect(result.scope_to_file.size).toBe(0);
    });

    it("returns empty result for file with no scopes", () => {
      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.size).toBe(0);
      expect(result.scope_to_file.size).toBe(0);
    });
  });

  describe("Local definition resolution", () => {
    it("resolves a local function definition in file scope", () => {
      const func_id = function_symbol("greet" as SymbolName, MOCK_LOCATION);

      scopes.update_file(
        TEST_FILE,
        new Map([[FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null)]])
      );
      definitions.update_file(TEST_FILE, [
        make_function("greet", FILE_SCOPE_ID, func_id),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)).toEqual(
        new Map<SymbolName, SymbolId>([["greet" as SymbolName, func_id]])
      );
    });

    it("resolves multiple definitions in the same scope", () => {
      const func_a = function_symbol("funcA" as SymbolName, MOCK_LOCATION);
      const func_b = function_symbol("funcB" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 5,
      });

      scopes.update_file(
        TEST_FILE,
        new Map([[FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null)]])
      );
      definitions.update_file(TEST_FILE, [
        make_function("funcA", FILE_SCOPE_ID, func_a),
        make_function("funcB", FILE_SCOPE_ID, func_b),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)).toEqual(
        new Map<SymbolName, SymbolId>([
          ["funcA" as SymbolName, func_a],
          ["funcB" as SymbolName, func_b],
        ])
      );
    });

    it("leaves an undefined name unresolved", () => {
      const func_id = function_symbol("greet" as SymbolName, MOCK_LOCATION);

      scopes.update_file(
        TEST_FILE,
        new Map([[FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null)]])
      );
      definitions.update_file(TEST_FILE, [
        make_function("greet", FILE_SCOPE_ID, func_id),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      const file_scope = result.resolutions_by_scope.get(FILE_SCOPE_ID)!;
      expect(file_scope.get("missing" as SymbolName)).toBeUndefined();
    });
  });

  describe("Lexical scope inheritance", () => {
    it("inherits parent scope resolutions in a child scope", () => {
      const outer_func = function_symbol("outer" as SymbolName, MOCK_LOCATION);
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [inner_scope_id])],
          [inner_scope_id, make_scope(inner_scope_id, "function", FILE_SCOPE_ID)],
        ])
      );
      definitions.update_file(TEST_FILE, [
        make_function("outer", FILE_SCOPE_ID, outer_func),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(inner_scope_id)).toEqual(
        new Map<SymbolName, SymbolId>([["outer" as SymbolName, outer_func]])
      );
    });

    it("lets a child scope shadow a parent definition", () => {
      const outer_func = function_symbol("func" as SymbolName, MOCK_LOCATION);
      const inner_func = function_symbol("func" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [inner_scope_id])],
          [inner_scope_id, make_scope(inner_scope_id, "function", FILE_SCOPE_ID)],
        ])
      );
      definitions.update_file(TEST_FILE, [
        make_function("func", FILE_SCOPE_ID, outer_func),
        make_function("func", inner_scope_id, inner_func),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(
        result.resolutions_by_scope.get(FILE_SCOPE_ID)!.get("func" as SymbolName)
      ).toBe(outer_func);
      expect(
        result.resolutions_by_scope.get(inner_scope_id)!.get("func" as SymbolName)
      ).toBe(inner_func);
    });
  });

  describe("Import resolution", () => {
    it("resolves a namespace import to the import's own symbol", () => {
      const import_id = namespace_symbol("utils" as SymbolName, MOCK_LOCATION);

      scopes.update_file(
        TEST_FILE,
        new Map([[FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null)]])
      );
      const ns_import: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_path: "./utils" as ModulePath,
        import_kind: "namespace",
      };
      imports.update_file(TEST_FILE, [ns_import], "typescript", create_module_resolution_context(mock_root_folder));

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)).toEqual(
        new Map<SymbolName, SymbolId>([["utils" as SymbolName, import_id]])
      );
    });

    it("drops a named import whose export chain and submodule fallback both fail", () => {
      const import_id = function_symbol("thing" as SymbolName, MOCK_LOCATION);

      scopes.update_file(
        TEST_FILE,
        new Map([[FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null)]])
      );
      const named_import: ImportDefinition = {
        kind: "import",
        symbol_id: import_id,
        name: "thing" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_path: "./unresolved" as ModulePath,
        import_kind: "named",
      };
      imports.update_file(TEST_FILE, [named_import], "typescript", create_module_resolution_context(mock_root_folder));

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)).toEqual(
        new Map<SymbolName, SymbolId>()
      );
    });
  });

  describe("Wildcard import layering", () => {
    const APP_PY = "app.py" as FilePath;
    const LIB_PY = "lib.py" as FilePath;
    const TWO_PY = "two.py" as FilePath;
    const APP_SCOPE = "scope:app.py:file:0:0" as ScopeId;

    const py_root_folder: FileSystemFolder = {
      path: "/" as FilePath,
      folders: new Map(),
      files: new Set(["app.py", "lib.py", "two.py", "app.ts", "lib.ts"]),
    };

    function py_context(): NameResolutionContext {
      return {
        languages: new Map<FilePath, Language>([
          [APP_PY, "python"],
          [LIB_PY, "python"],
          [TWO_PY, "python"],
        ]),
        definitions,
        scopes,
        exports,
        imports,
        resolution: create_module_resolution_context(py_root_folder),
      };
    }

    function make_wildcard_import(
      file: FilePath,
      scope_id: ScopeId,
      import_path: string
    ): ImportDefinition {
      const name = import_path.replace(/\.py$/, "");
      return {
        kind: "import",
        symbol_id: variable_symbol(name as SymbolName, MOCK_LOCATION),
        name: name as SymbolName,
        defining_scope_id: scope_id,
        location: { ...MOCK_LOCATION, file_path: file },
        import_path: import_path as ModulePath,
        import_kind: "wildcard",
        export: { is_reexport: true },
      };
    }

    function export_function_from(
      file: FilePath,
      name: string,
      start_line: number
    ): SymbolId {
      const fn: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol(name as SymbolName, {
          ...MOCK_LOCATION,
          file_path: file,
          start_line,
        }),
        name: name as SymbolName,
        defining_scope_id: `scope:${file}:file:0:0` as ScopeId,
        location: { ...MOCK_LOCATION, file_path: file, start_line },
        signature: { parameters: [] },
        body_scope_id: `scope:${file}:${name}:1:0` as ScopeId,
        is_exported: true,
      };
      definitions.update_file(file, [fn]);
      exports.update_file(file, definitions);
      return fn.symbol_id;
    }

    it("binds a wildcard import's target surface into the importing scope", () => {
      const helper_id = export_function_from(LIB_PY, "helper", 1);
      scopes.update_file(
        APP_PY,
        new Map([[APP_SCOPE, make_scope(APP_SCOPE, "global", null)]])
      );
      imports.update_file(
        APP_PY,
        [make_wildcard_import(APP_PY, APP_SCOPE, "lib")],
        "python",
        create_module_resolution_context(py_root_folder)
      );

      const result = resolve_names(new Set([APP_PY]), py_context());

      expect(result.resolutions_by_scope.get(APP_SCOPE)).toEqual(
        new Map<SymbolName, SymbolId>([["helper" as SymbolName, helper_id]])
      );
    });

    it("lets an explicit named import shadow a name the wildcard also provides", () => {
      export_function_from(LIB_PY, "shared", 1);
      const two_id = export_function_from(TWO_PY, "shared", 1);
      scopes.update_file(
        APP_PY,
        new Map([[APP_SCOPE, make_scope(APP_SCOPE, "global", null)]])
      );
      const named_import: ImportDefinition = {
        kind: "import",
        symbol_id: variable_symbol("shared" as SymbolName, {
          ...MOCK_LOCATION,
          start_line: 2,
        }),
        name: "shared" as SymbolName,
        defining_scope_id: APP_SCOPE,
        location: { ...MOCK_LOCATION, file_path: APP_PY, start_line: 2 },
        import_path: "two" as ModulePath,
        import_kind: "named",
      };
      imports.update_file(
        APP_PY,
        [make_wildcard_import(APP_PY, APP_SCOPE, "lib"), named_import],
        "python",
        create_module_resolution_context(py_root_folder)
      );

      const result = resolve_names(new Set([APP_PY]), py_context());

      expect(
        result.resolutions_by_scope.get(APP_SCOPE)!.get("shared" as SymbolName)
      ).toBe(two_id);
    });

    it("lets a local definition shadow a name the wildcard provides", () => {
      export_function_from(LIB_PY, "helper", 1);
      const local_id = function_symbol("helper" as SymbolName, {
        ...MOCK_LOCATION,
        file_path: APP_PY,
        start_line: 3,
      });
      scopes.update_file(
        APP_PY,
        new Map([[APP_SCOPE, make_scope(APP_SCOPE, "global", null)]])
      );
      definitions.update_file(APP_PY, [
        {
          ...make_function("helper", APP_SCOPE, local_id),
          location: { ...MOCK_LOCATION, file_path: APP_PY, start_line: 3 },
        },
      ]);
      imports.update_file(
        APP_PY,
        [make_wildcard_import(APP_PY, APP_SCOPE, "lib")],
        "python",
        create_module_resolution_context(py_root_folder)
      );

      const result = resolve_names(new Set([APP_PY]), py_context());

      expect(
        result.resolutions_by_scope.get(APP_SCOPE)!.get("helper" as SymbolName)
      ).toBe(local_id);
    });

    it("does not layer a wildcard surface into a JavaScript or TypeScript scope", () => {
      const APP_TS = "app.ts" as FilePath;
      const LIB_TS = "lib.ts" as FilePath;
      const APP_TS_SCOPE = "scope:app.ts:file:0:0" as ScopeId;

      const fn: FunctionDefinition = {
        kind: "function",
        symbol_id: function_symbol("helper" as SymbolName, {
          ...MOCK_LOCATION,
          file_path: LIB_TS,
        }),
        name: "helper" as SymbolName,
        defining_scope_id: "scope:lib.ts:file:0:0" as ScopeId,
        location: { ...MOCK_LOCATION, file_path: LIB_TS },
        signature: { parameters: [] },
        body_scope_id: "scope:lib.ts:helper:1:0" as ScopeId,
        is_exported: true,
      };
      definitions.update_file(LIB_TS, [fn]);
      exports.update_file(LIB_TS, definitions);

      scopes.update_file(
        APP_TS,
        new Map([[APP_TS_SCOPE, make_scope(APP_TS_SCOPE, "global", null)]])
      );
      const star_reexport: ImportDefinition = {
        kind: "import",
        symbol_id: variable_symbol("lib" as SymbolName, MOCK_LOCATION),
        name: "lib" as SymbolName,
        defining_scope_id: APP_TS_SCOPE,
        location: { ...MOCK_LOCATION, file_path: APP_TS },
        import_path: "./lib" as ModulePath,
        import_kind: "wildcard",
        export: { is_reexport: true },
      };
      imports.update_file(APP_TS, [star_reexport], "typescript", create_module_resolution_context(py_root_folder));

      const ts_context: NameResolutionContext = {
        languages: new Map<FilePath, Language>([
          [APP_TS, "typescript"],
          [LIB_TS, "typescript"],
        ]),
        definitions,
        scopes,
        exports,
        imports,
        resolution: create_module_resolution_context(py_root_folder),
      };
      const result = resolve_names(new Set([APP_TS]), ts_context);

      expect(result.resolutions_by_scope.get(APP_TS_SCOPE)).toEqual(
        new Map<SymbolName, SymbolId>()
      );
    });
  });

  describe("Self-initializer carve-out", () => {
    it("keeps an inherited binding when a same-named local is its own initializer", () => {
      const outer_func = function_symbol("has_flatten" as SymbolName, MOCK_LOCATION);
      const local_var = variable_symbol("has_flatten" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 4,
      });
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [inner_scope_id])],
          [inner_scope_id, make_scope(inner_scope_id, "function", FILE_SCOPE_ID)],
        ])
      );
      const self_init: VariableDefinition = {
        kind: "variable",
        symbol_id: local_var,
        name: "has_flatten" as SymbolName,
        defining_scope_id: inner_scope_id,
        location: { ...MOCK_LOCATION, start_line: 4 },
        is_exported: false,
        initialized_from_call: "has_flatten" as SymbolName,
      };
      definitions.update_file(TEST_FILE, [
        make_function("has_flatten", FILE_SCOPE_ID, outer_func),
        self_init,
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(
        result.resolutions_by_scope
          .get(inner_scope_id)!
          .get("has_flatten" as SymbolName)
      ).toBe(outer_func);
    });

    it("overrides an inherited binding for an ordinary same-named local", () => {
      const outer_func = function_symbol("value" as SymbolName, MOCK_LOCATION);
      const local_var = variable_symbol("value" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 4,
      });
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [inner_scope_id])],
          [inner_scope_id, make_scope(inner_scope_id, "function", FILE_SCOPE_ID)],
        ])
      );
      const ordinary_local: VariableDefinition = {
        kind: "variable",
        symbol_id: local_var,
        name: "value" as SymbolName,
        defining_scope_id: inner_scope_id,
        location: { ...MOCK_LOCATION, start_line: 4 },
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [
        make_function("value", FILE_SCOPE_ID, outer_func),
        ordinary_local,
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(
        result.resolutions_by_scope.get(inner_scope_id)!.get("value" as SymbolName)
      ).toBe(local_var);
    });
  });

  describe("Function hoisting", () => {
    it("hoists a function declared in a descendant block into the enclosing scope", () => {
      const helper_id = function_symbol("helper" as SymbolName, MOCK_LOCATION);
      const block_scope_id = "scope:test.ts:block:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [block_scope_id])],
          [block_scope_id, make_scope(block_scope_id, "block", FILE_SCOPE_ID)],
        ])
      );
      definitions.update_file(TEST_FILE, [
        make_function("helper", block_scope_id, helper_id),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(
        result.resolutions_by_scope.get(FILE_SCOPE_ID)!.get("helper" as SymbolName)
      ).toBe(helper_id);
    });

    it("does not hoist a non-function declared in a descendant block", () => {
      const var_id = variable_symbol("temp" as SymbolName, MOCK_LOCATION);
      const block_scope_id = "scope:test.ts:block:2:0" as ScopeId;

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [block_scope_id])],
          [block_scope_id, make_scope(block_scope_id, "block", FILE_SCOPE_ID)],
        ])
      );
      const block_var: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "temp" as SymbolName,
        defining_scope_id: block_scope_id,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [block_var]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(
        result.resolutions_by_scope.get(FILE_SCOPE_ID)!.get("temp" as SymbolName)
      ).toBeUndefined();
    });
  });

  describe("Multiple files", () => {
    it("resolves names across multiple files", () => {
      const file_a = "a.ts" as FilePath;
      const file_b = "b.ts" as FilePath;
      const scope_a = "scope:a.ts:file:0:0" as ScopeId;
      const scope_b = "scope:b.ts:file:0:0" as ScopeId;

      const func_a = function_symbol("funcA" as SymbolName, {
        ...MOCK_LOCATION,
        file_path: file_a,
      });
      const func_b = function_symbol("funcB" as SymbolName, {
        ...MOCK_LOCATION,
        file_path: file_b,
      });

      context = {
        ...context,
        languages: new Map([
          [file_a, "typescript"],
          [file_b, "typescript"],
        ]),
      };

      scopes.update_file(
        file_a,
        new Map([[scope_a, make_scope(scope_a, "global", null)]])
      );
      scopes.update_file(
        file_b,
        new Map([[scope_b, make_scope(scope_b, "global", null)]])
      );
      definitions.update_file(file_a, [make_function("funcA", scope_a, func_a)]);
      definitions.update_file(file_b, [make_function("funcB", scope_b, func_b)]);

      const result = resolve_names(new Set([file_a, file_b]), context);

      expect(result.resolutions_by_scope.get(scope_a)).toEqual(
        new Map<SymbolName, SymbolId>([["funcA" as SymbolName, func_a]])
      );
      expect(result.resolutions_by_scope.get(scope_b)).toEqual(
        new Map<SymbolName, SymbolId>([["funcB" as SymbolName, func_b]])
      );
      expect(result.scope_to_file.get(scope_a)).toBe(file_a);
      expect(result.scope_to_file.get(scope_b)).toBe(file_b);
    });
  });

  describe("scope_to_file tracking", () => {
    it("tracks which file each scope belongs to", () => {
      const func_id = function_symbol("greet" as SymbolName, MOCK_LOCATION);

      scopes.update_file(
        TEST_FILE,
        new Map([
          [FILE_SCOPE_ID, make_scope(FILE_SCOPE_ID, "global", null, [FUNC_SCOPE_ID])],
          [FUNC_SCOPE_ID, make_scope(FUNC_SCOPE_ID, "function", FILE_SCOPE_ID)],
        ])
      );
      definitions.update_file(TEST_FILE, [
        make_function("greet", FILE_SCOPE_ID, func_id),
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.scope_to_file).toEqual(
        new Map<ScopeId, FilePath>([
          [FILE_SCOPE_ID, TEST_FILE],
          [FUNC_SCOPE_ID, TEST_FILE],
        ])
      );
    });
  });
});
