import { describe, it, expect } from "vitest";
import {
  normalize_path_prefix,
  is_callable_definition,
  resolve_qualified_path_rust,
  type RustPathResolutionContext,
} from "./path_resolution.rust";
import { DefinitionRegistry } from "../registries/definition";
import { ScopeRegistry } from "../registries/scope";
import { ResolutionRegistry } from "../resolution_registry";
import { ImportGraph } from "../import_resolution/import_graph";
import { make_export_chain_context } from "../resolution_test_helpers";
import { set_test_resolutions } from "../resolve_references.test";
import {
  class_symbol,
  method_symbol,
  function_symbol,
  variable_symbol,
  namespace_symbol,
} from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
  Location,
  LexicalScope,
  ClassDefinition,
  MethodDefinition,
  FunctionDefinition,
  VariableDefinition,
  NamespaceDefinition,
} from "@ariadnejs/types";

const FILE = "m.rs" as FilePath;
const LOC: Location = {
  file_path: FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

describe("normalize_path_prefix", () => {
  it("strips a leading crate anchor", () => {
    expect(
      normalize_path_prefix(["crate", "runtime", "Driver"] as SymbolName[])
    ).toEqual(["runtime", "Driver"] as SymbolName[]);
  });

  it("strips consecutive self/super anchors", () => {
    expect(
      normalize_path_prefix(["self", "super", "worker"] as SymbolName[])
    ).toEqual(["worker"] as SymbolName[]);
  });

  it("leaves a prefix with no leading anchor unchanged", () => {
    expect(normalize_path_prefix(["worker", "create"] as SymbolName[])).toEqual([
      "worker",
      "create",
    ] as SymbolName[]);
  });

  it("does not strip an anchor that is not leading", () => {
    expect(
      normalize_path_prefix(["worker", "crate"] as SymbolName[])
    ).toEqual(["worker", "crate"] as SymbolName[]);
  });

  it("returns an empty prefix when every segment is an anchor", () => {
    expect(normalize_path_prefix(["crate", "self"] as SymbolName[])).toEqual([]);
  });
});

describe("is_callable_definition", () => {
  const method_id = method_symbol("run", LOC);
  const function_id = function_symbol("run" as SymbolName, LOC);
  const variable_id = variable_symbol("run", LOC);

  function setup(): DefinitionRegistry {
    const definitions = new DefinitionRegistry();
    const method_def: MethodDefinition = {
      kind: "method",
      symbol_id: method_id,
      name: "run" as SymbolName,
      defining_scope_id: "scope:m.rs:C:1:0" as ScopeId,
      location: LOC,
      parameters: [],
    };
    const function_def: FunctionDefinition = {
      kind: "function",
      symbol_id: function_id,
      name: "run" as SymbolName,
      defining_scope_id: "scope:m.rs:file:0:0" as ScopeId,
      location: LOC,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:m.rs:run:1:0" as ScopeId,
    };
    const variable_def: VariableDefinition = {
      kind: "variable",
      symbol_id: variable_id,
      name: "run" as SymbolName,
      defining_scope_id: "scope:m.rs:file:0:0" as ScopeId,
      location: LOC,
      is_exported: false,
    };
    definitions.update_file(FILE, [method_def, function_def, variable_def]);
    return definitions;
  }

  it("treats a method as callable", () => {
    expect(is_callable_definition(method_id, setup())).toBe(true);
  });

  it("treats a function as callable", () => {
    expect(is_callable_definition(function_id, setup())).toBe(true);
  });

  it("rejects a non-callable variable definition", () => {
    expect(is_callable_definition(variable_id, setup())).toBe(false);
  });

  it("rejects an unknown symbol id", () => {
    expect(
      is_callable_definition(class_symbol("Ghost", LOC), setup())
    ).toBe(false);
  });
});

// The two hops that read the scope map, isolated from the file tree: an empty
// root folder means the module-file hop can never land, so each case pins the
// hop it names and nothing else.
describe("resolve_qualified_path_rust", () => {
  const FILE_SCOPE = "scope:m.rs:file:0:0" as ScopeId;
  const MODULE_SCOPE = "scope:m.rs:runtime:1:0" as ScopeId;

  function setup(): RustPathResolutionContext {
    const definitions = new DefinitionRegistry();
    const scopes = new ScopeRegistry();
    const resolutions = new ResolutionRegistry();
    const { exports, languages, resolution } = make_export_chain_context();

    const file_scope: LexicalScope = {
      id: FILE_SCOPE,
      parent_id: null,
      name: null,
      type: "module",
      location: LOC,
      child_ids: [MODULE_SCOPE],
    };
    const module_scope: LexicalScope = {
      id: MODULE_SCOPE,
      parent_id: FILE_SCOPE,
      name: "runtime" as SymbolName,
      type: "module",
      location: LOC,
      child_ids: [],
    };
    scopes.update_file(
      FILE,
      new Map([
        [FILE_SCOPE, file_scope],
        [MODULE_SCOPE, module_scope],
      ])
    );

    const make_start = (line: number): Location => ({ ...LOC, start_line: line });

    // `mod runtime { pub struct Driver { fn make(); field } fn helper() }`
    const make_method: MethodDefinition = {
      kind: "method",
      symbol_id: method_symbol("make", make_start(3)),
      name: "make" as SymbolName,
      defining_scope_id: MODULE_SCOPE,
      location: make_start(3),
      parameters: [],
    };
    const driver: ClassDefinition = {
      kind: "class",
      symbol_id: class_symbol("Driver", make_start(2)),
      name: "Driver" as SymbolName,
      defining_scope_id: MODULE_SCOPE,
      location: make_start(2),
      is_exported: false,
      extends: [],
      methods: [make_method],
      properties: [
        {
          kind: "property",
          symbol_id: "property:m.rs:4:0:4:8:field" as SymbolId,
          name: "field" as SymbolName,
          defining_scope_id: MODULE_SCOPE,
          location: make_start(4),
          decorators: [],
        },
      ],
      decorators: [],
      constructors: [],
    };
    const helper: FunctionDefinition = {
      kind: "function",
      symbol_id: function_symbol("helper" as SymbolName, make_start(5)),
      name: "helper" as SymbolName,
      defining_scope_id: MODULE_SCOPE,
      location: make_start(5),
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:m.rs:helper:5:0" as ScopeId,
    };
    const runtime: NamespaceDefinition = {
      kind: "namespace",
      symbol_id: namespace_symbol("runtime", make_start(1)),
      name: "runtime" as SymbolName,
      defining_scope_id: FILE_SCOPE,
      location: make_start(1),
      is_exported: false,
    };
    definitions.update_file(FILE, [driver, helper, runtime]);

    const scope_resolutions = new Map<SymbolName, SymbolId>([
      ["Driver" as SymbolName, driver.symbol_id],
      ["runtime" as SymbolName, runtime.symbol_id],
    ]);
    set_test_resolutions(resolutions, FILE_SCOPE, scope_resolutions);

    return {
      definitions,
      scopes,
      resolutions,
      exports,
      imports: new ImportGraph(),
      languages,
      resolution,
    };
  }

  it("takes a callable terminal from the member index of an in-scope type", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["Driver"] as SymbolName[],
        "make" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toEqual(method_symbol("make", { ...LOC, start_line: 3 }));
  });

  it("rejects a non-callable member of an in-scope type", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["Driver"] as SymbolName[],
        "field" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toBeNull();
  });

  it("takes a terminal from the body of an in-scope module block", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["runtime"] as SymbolName[],
        "helper" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toEqual(function_symbol("helper" as SymbolName, { ...LOC, start_line: 5 }));
  });

  it("resolves a type terminal in an in-scope module block", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["runtime"] as SymbolName[],
        "Driver" as SymbolName,
        "type",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toEqual(class_symbol("Driver", { ...LOC, start_line: 2 }));
  });

  it("returns null when the module block holds no such terminal", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["runtime"] as SymbolName[],
        "missing" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toBeNull();
  });

  it("returns null for an empty module path", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        [],
        "helper" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toBeNull();
  });

  it("returns null for a bare leading segment that names no module in scope", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["serde_json"] as SymbolName[],
        "to_string" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toBeNull();
  });

  it("returns null for a Self path deeper than one segment", () => {
    const context = setup();
    expect(
      resolve_qualified_path_rust(
        ["Self", "Inner"] as SymbolName[],
        "f" as SymbolName,
        "callable",
        FILE_SCOPE,
        FILE,
        context
      )
    ).toBeNull();
  });
});
