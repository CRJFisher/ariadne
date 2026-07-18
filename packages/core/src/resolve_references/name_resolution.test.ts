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
      root_folder: mock_root_folder,
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
      imports.update_file(TEST_FILE, [ns_import], "typescript", mock_root_folder);

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
      imports.update_file(TEST_FILE, [named_import], "typescript", mock_root_folder);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)).toEqual(
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
