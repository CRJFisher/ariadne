import { describe, it, expect } from "vitest";
import {
  normalize_path_prefix,
  resolve_in_module_body,
  is_callable_definition,
} from "./path_resolution";
import { DefinitionRegistry } from "../registries/definition";
import { ScopeRegistry } from "../registries/scope";
import {
  class_symbol,
  method_symbol,
  function_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import type {
  SymbolName,
  ScopeId,
  FilePath,
  Location,
  LexicalScope,
  ClassDefinition,
  MethodDefinition,
  FunctionDefinition,
  VariableDefinition,
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

describe("resolve_in_module_body", () => {
  const FILE_SCOPE = "scope:m.rs:file:0:0" as ScopeId;
  const MODULE_SCOPE = "scope:m.rs:runtime:1:0" as ScopeId;

  function setup(): { definitions: DefinitionRegistry; scopes: ScopeRegistry } {
    const definitions = new DefinitionRegistry();
    const scopes = new ScopeRegistry();

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

    const driver: ClassDefinition = {
      kind: "class",
      symbol_id: class_symbol("Driver", LOC),
      name: "Driver" as SymbolName,
      defining_scope_id: MODULE_SCOPE,
      location: LOC,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };
    definitions.update_file(FILE, [driver]);
    return { definitions, scopes };
  }

  it("resolves a terminal defined in the named module's body", () => {
    const { definitions, scopes } = setup();
    const result = resolve_in_module_body(
      "runtime" as SymbolName,
      FILE_SCOPE,
      "Driver" as SymbolName,
      scopes,
      definitions
    );
    expect(result).toEqual(class_symbol("Driver", LOC));
  });

  it("returns null when the terminal is not in the module body", () => {
    const { definitions, scopes } = setup();
    const result = resolve_in_module_body(
      "runtime" as SymbolName,
      FILE_SCOPE,
      "Missing" as SymbolName,
      scopes,
      definitions
    );
    expect(result).toBeNull();
  });

  it("returns null when no child module matches the qualifier", () => {
    const { definitions, scopes } = setup();
    const result = resolve_in_module_body(
      "other" as SymbolName,
      FILE_SCOPE,
      "Driver" as SymbolName,
      scopes,
      definitions
    );
    expect(result).toBeNull();
  });

  it("returns null when the defining scope is not registered", () => {
    const { definitions, scopes } = setup();
    const result = resolve_in_module_body(
      "runtime" as SymbolName,
      "scope:m.rs:missing:9:0" as ScopeId,
      "Driver" as SymbolName,
      scopes,
      definitions
    );
    expect(result).toBeNull();
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
