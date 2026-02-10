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
import { ImportGraph } from "../project/import_graph";
import { function_symbol, class_symbol } from "@ariadnejs/types";
import type {
  FilePath,
  ScopeId,
  SymbolName,
  Location,
  FunctionDefinition,
  Language,
  LexicalScope,
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

describe("resolve_names", () => {
  let definitions: DefinitionRegistry;
  let scopes: ScopeRegistry;
  let exports: ExportRegistry;
  let imports: ImportGraph;
  let context: NameResolutionContext;

  const mock_root_folder: FileSystemFolder = {
    name: "",
    type: "folder",
    path: "/" as FilePath,
    children: [],
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
    it("should return empty result for empty file_ids", () => {
      const result = resolve_names(new Set(), context);

      expect(result.resolutions_by_scope.size).toBe(0);
      expect(result.scope_to_file.size).toBe(0);
    });

    it("should return empty result for file with no scopes", () => {
      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.size).toBe(0);
      expect(result.scope_to_file.size).toBe(0);
    });
  });

  describe("Local definition resolution", () => {
    it("should resolve local function definition in file scope", () => {
      const func_id = function_symbol("greet", TEST_FILE, MOCK_LOCATION);

      // Set up scope
      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "file",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      // Set up definition
      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "greet" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [func_def]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.resolutions_by_scope.size).toBe(1);

      const file_scope_resolutions = result.resolutions_by_scope.get(FILE_SCOPE_ID);
      expect(file_scope_resolutions).toBeDefined();
      expect(file_scope_resolutions!.get("greet" as SymbolName)).toBe(func_id);
    });

    it("should resolve multiple definitions in same scope", () => {
      const func_a = function_symbol("funcA", TEST_FILE, MOCK_LOCATION);
      const func_b = function_symbol("funcB", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 5,
      });

      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "file",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: func_a,
          name: "funcA" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          parameters: [],
          body_scope_id: "scope:test.ts:funcA:1:0" as ScopeId,
          is_exported: false,
        },
        {
          kind: "function",
          symbol_id: func_b,
          name: "funcB" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: { ...MOCK_LOCATION, start_line: 5 },
          parameters: [],
          body_scope_id: "scope:test.ts:funcB:5:0" as ScopeId,
          is_exported: false,
        },
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      const file_scope_resolutions = result.resolutions_by_scope.get(FILE_SCOPE_ID);
      expect(file_scope_resolutions!.size).toBe(2);
      expect(file_scope_resolutions!.get("funcA" as SymbolName)).toBe(func_a);
      expect(file_scope_resolutions!.get("funcB" as SymbolName)).toBe(func_b);
    });
  });

  describe("Lexical scope inheritance", () => {
    it("should inherit parent scope resolutions in child scope", () => {
      const outer_func = function_symbol("outer", TEST_FILE, MOCK_LOCATION);
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      // Set up nested scopes
      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "file",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            location: { ...MOCK_LOCATION, start_line: 2 },
            parent_id: FILE_SCOPE_ID,
            name: "inner" as SymbolName,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      // Define outer in file scope
      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: outer_func,
          name: "outer" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          parameters: [],
          body_scope_id: "scope:test.ts:outer:1:0" as ScopeId,
          is_exported: false,
        },
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      // Inner scope should inherit outer's resolution
      const inner_resolutions = result.resolutions_by_scope.get(inner_scope_id);
      expect(inner_resolutions).toBeDefined();
      expect(inner_resolutions!.get("outer" as SymbolName)).toBe(outer_func);
    });

    it("should allow child scope to shadow parent definition", () => {
      const outer_func = function_symbol("func", TEST_FILE, MOCK_LOCATION);
      const inner_func = function_symbol("func", TEST_FILE, {
        ...MOCK_LOCATION,
        start_line: 3,
      });
      const inner_scope_id = "scope:test.ts:inner:2:0" as ScopeId;

      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "file",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            location: { ...MOCK_LOCATION, start_line: 2 },
            parent_id: FILE_SCOPE_ID,
            name: "inner" as SymbolName,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: outer_func,
          name: "func" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          parameters: [],
          body_scope_id: "scope:test.ts:func:1:0" as ScopeId,
          is_exported: false,
        },
        {
          kind: "function",
          symbol_id: inner_func,
          name: "func" as SymbolName,
          defining_scope_id: inner_scope_id,
          location: { ...MOCK_LOCATION, start_line: 3 },
          parameters: [],
          body_scope_id: "scope:test.ts:func:3:0" as ScopeId,
          is_exported: false,
        },
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      // File scope has outer
      expect(result.resolutions_by_scope.get(FILE_SCOPE_ID)!.get("func" as SymbolName)).toBe(
        outer_func
      );

      // Inner scope has inner (shadows outer)
      expect(result.resolutions_by_scope.get(inner_scope_id)!.get("func" as SymbolName)).toBe(
        inner_func
      );
    });
  });

  describe("Multiple files", () => {
    it("should resolve names across multiple files", () => {
      const file_a = "a.ts" as FilePath;
      const file_b = "b.ts" as FilePath;
      const scope_a = "scope:a.ts:file:0:0" as ScopeId;
      const scope_b = "scope:b.ts:file:0:0" as ScopeId;

      const func_a = function_symbol("funcA", file_a, {
        ...MOCK_LOCATION,
        file_path: file_a,
      });
      const func_b = function_symbol("funcB", file_b, {
        ...MOCK_LOCATION,
        file_path: file_b,
      });

      // Update context with both languages
      context = {
        ...context,
        languages: new Map([
          [file_a, "typescript"],
          [file_b, "typescript"],
        ]),
      };

      // Set up scopes for both files
      scopes.update_file(
        file_a,
        new Map([
          [
            scope_a,
            {
              id: scope_a,
              type: "file",
              location: { ...MOCK_LOCATION, file_path: file_a },
              parent_id: null,
              name: null,
              child_ids: [],
            },
          ],
        ])
      );
      scopes.update_file(
        file_b,
        new Map([
          [
            scope_b,
            {
              id: scope_b,
              type: "file",
              location: { ...MOCK_LOCATION, file_path: file_b },
              parent_id: null,
              name: null,
              child_ids: [],
            },
          ],
        ])
      );

      // Set up definitions
      definitions.update_file(file_a, [
        {
          kind: "function",
          symbol_id: func_a,
          name: "funcA" as SymbolName,
          defining_scope_id: scope_a,
          location: { ...MOCK_LOCATION, file_path: file_a },
          parameters: [],
          body_scope_id: "scope:a.ts:funcA:1:0" as ScopeId,
          is_exported: false,
        },
      ]);
      definitions.update_file(file_b, [
        {
          kind: "function",
          symbol_id: func_b,
          name: "funcB" as SymbolName,
          defining_scope_id: scope_b,
          location: { ...MOCK_LOCATION, file_path: file_b },
          parameters: [],
          body_scope_id: "scope:b.ts:funcB:1:0" as ScopeId,
          is_exported: false,
        },
      ]);

      const result = resolve_names(new Set([file_a, file_b]), context);

      expect(result.resolutions_by_scope.size).toBe(2);
      expect(result.resolutions_by_scope.get(scope_a)!.get("funcA" as SymbolName)).toBe(
        func_a
      );
      expect(result.resolutions_by_scope.get(scope_b)!.get("funcB" as SymbolName)).toBe(
        func_b
      );

      expect(result.scope_to_file.get(scope_a)).toBe(file_a);
      expect(result.scope_to_file.get(scope_b)).toBe(file_b);
    });
  });

  describe("scope_to_file tracking", () => {
    it("should track which file each scope belongs to", () => {
      const func_id = function_symbol("greet", TEST_FILE, MOCK_LOCATION);

      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "file",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [FUNC_SCOPE_ID],
          },
        ],
        [
          FUNC_SCOPE_ID,
          {
            id: FUNC_SCOPE_ID,
            type: "function",
            location: MOCK_LOCATION,
            parent_id: FILE_SCOPE_ID,
            name: "greet" as SymbolName,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: func_id,
          name: "greet" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          parameters: [],
          body_scope_id: FUNC_SCOPE_ID,
          is_exported: false,
        },
      ]);

      const result = resolve_names(new Set([TEST_FILE]), context);

      expect(result.scope_to_file.get(FILE_SCOPE_ID)).toBe(TEST_FILE);
      expect(result.scope_to_file.get(FUNC_SCOPE_ID)).toBe(TEST_FILE);
    });
  });
});
