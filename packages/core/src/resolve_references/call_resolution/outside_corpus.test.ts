import { describe, it, expect, beforeEach } from "vitest";
import type {
  ClassDefinition,
  FilePath,
  ImportDefinition,
  Language,
  LexicalScope,
  ModulePath,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { class_symbol } from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { ResolutionRegistry } from "../resolution_registry";
import { ImportGraph } from "../import_resolution/import_graph";
import { set_test_resolutions } from "../resolve_references.test";
import { unindexed_base_failure, type OutsideCorpusContext } from "./outside_corpus";

const TEST_FILE = "test.ts" as FilePath;
const BASE_FILE = "base.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;

function location_at(line: number) {
  return { file_path: TEST_FILE, start_line: line, start_column: 0, end_line: line, end_column: 10 };
}

function make_class(name: string, line: number, base_names: string[]): ClassDefinition {
  return {
    kind: "class",
    symbol_id: class_symbol(name as SymbolName, location_at(line)),
    name: name as SymbolName,
    defining_scope_id: FILE_SCOPE_ID,
    location: location_at(line),
    is_exported: false,
    extends: base_names as SymbolName[],
    methods: [],
    properties: [],
    decorators: [],
  };
}

function make_import(name: string, path: string): ImportDefinition {
  return {
    kind: "import",
    symbol_id: `import:test.ts:1:0:1:20:${name}` as SymbolId,
    name: name as SymbolName,
    defining_scope_id: FILE_SCOPE_ID,
    location: location_at(1),
    import_kind: "named",
    import_path: path as ModulePath,
  };
}

describe("unindexed_base_failure", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;
  let imports: ImportGraph;
  let languages: Map<FilePath, Language>;
  let context: OutsideCorpusContext;

  beforeEach(() => {
    const scopes = new ScopeRegistry();
    scopes.update_file(
      TEST_FILE,
      new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "global",
            location: location_at(0),
            parent_id: null,
            name: null,
            child_ids: [],
            self_type_name: null,
          },
        ],
      ])
    );
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
    imports = new ImportGraph();
    languages = new Map([[TEST_FILE, "typescript"]]);
    context = { scopes, definitions, resolutions, imports, languages };
  });

  it("names the import binding a base whose module names no indexed file", () => {
    const widget = make_class("Widget", 3, ["Component"]);
    const component = make_import("Component", "some-missing-pkg");
    definitions.update_file(TEST_FILE, [component, widget]);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([[component.name, component.symbol_id]]));

    expect(unindexed_base_failure(widget.symbol_id, context)).toEqual({
      stage: "import_resolution",
      reason: "import_unresolved",
      partial_info: { resolved_receiver_type: widget.symbol_id, import_specifier: "some-missing-pkg" },
    });
  });

  it("finds the unindexed import through an indexed base", () => {
    const child = make_class("Child", 3, ["Middle"]);
    const middle = make_class("Middle", 7, ["Component"]);
    const component = make_import("Component", "some-missing-pkg");
    definitions.update_file(TEST_FILE, [component, child, middle]);
    definitions.resolve_type_heritage(TEST_FILE, (_scope, name) =>
      name === ("Middle" as SymbolName) ? middle.symbol_id : null
    );
    set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([[component.name, component.symbol_id]]));

    expect(unindexed_base_failure(child.symbol_id, context)).toEqual({
      stage: "import_resolution",
      reason: "import_unresolved",
      partial_info: { resolved_receiver_type: child.symbol_id, import_specifier: "some-missing-pkg" },
    });
  });

  it("is null for a class that extends nothing", () => {
    const lone = make_class("Lone", 3, []);
    definitions.update_file(TEST_FILE, [lone]);

    expect(unindexed_base_failure(lone.symbol_id, context)).toEqual(null);
  });

  it("is null when the base's import names an indexed file", () => {
    const child = make_class("Child", 3, ["Base"]);
    const base = make_import("Base", "./base");
    definitions.update_file(TEST_FILE, [base, child]);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([[base.name, base.symbol_id]]));
    imports["resolved_import_paths"].set(base.symbol_id, BASE_FILE);
    languages.set(BASE_FILE, "typescript");

    expect(unindexed_base_failure(child.symbol_id, context)).toEqual(null);
  });
});
