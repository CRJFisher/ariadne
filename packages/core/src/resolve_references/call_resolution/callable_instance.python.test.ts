import { describe, it, expect, beforeEach } from "vitest";
import { resolve_callable_instance } from "./callable_instance.python";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolution_registry";
import { set_test_resolutions } from "../resolve_references.test";
import { make_export_chain_context } from "../resolution_test_helpers";
import {
  variable_symbol,
  constant_symbol,
  class_symbol,
  method_symbol,
  function_symbol,
} from "@ariadnejs/types";
import type { SemanticIndex } from "@ariadnejs/types";
import type {
  ClassDefinition,
  MethodDefinition,
  VariableDefinition,
  FunctionDefinition,
  AnyDefinition,
  FilePath,
  ScopeId,
  SymbolName,
  SymbolId,
  Location,
} from "@ariadnejs/types";
import { create_module_resolution_context } from "../import_resolution";

const file_path = "processor.py" as FilePath;
const module_scope = "module:0:0" as ScopeId;

const {
  exports: empty_exports,
  languages: empty_languages,
  resolution: empty_resolution,
} = make_export_chain_context();

function location(start_line: number, start_column = 0): Location {
  return {
    file_path,
    start_line,
    start_column,
    end_line: start_line + 1,
    end_column: start_column + 4,
  };
}

function make_class(
  name: string,
  line: number,
  method_names: string[],
  extends_names: SymbolName[] = []
): { id: SymbolId; def: ClassDefinition } {
  const id = class_symbol(name, location(line));
  const methods: MethodDefinition[] = method_names.map((method_name, idx) => ({
    kind: "method",
    symbol_id: method_symbol(method_name, location(line + 1 + idx, 4)),
    name: method_name as SymbolName,
    location: location(line + 1 + idx, 4),
    defining_scope_id: module_scope,
    parameters: [],
  }));
  return {
    id,
    def: {
      kind: "class",
      symbol_id: id,
      name: name as SymbolName,
      location: location(line),
      defining_scope_id: module_scope,
      is_exported: false,
      extends: extends_names,
      methods,
      properties: [],
      decorators: [],
      constructors: [],
    },
  };
}

function make_typed_variable(
  name: string,
  type_name: string,
  line: number
): { id: SymbolId; def: VariableDefinition } {
  const id = variable_symbol(name, location(line));
  return {
    id,
    def: {
      kind: "variable",
      symbol_id: id,
      name: name as SymbolName,
      location: location(line),
      defining_scope_id: module_scope,
      is_exported: false,
      type: type_name as SymbolName,
    },
  };
}

function make_index(
  variables: Map<SymbolId, VariableDefinition>,
  classes: Map<SymbolId, ClassDefinition>
): SemanticIndex {
  return {
    file_path,
    language: "python",
    root_scope_id: module_scope,
    scopes: new Map(),
    functions: new Map(),
    classes,
    variables,
    interfaces: new Map(),
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
    imported_symbols: new Map(),
    references: [],
  };
}

describe("resolve_callable_instance", () => {
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("resolves an instance call to the class __call__ method", () => {
    const { id: class_id, def: class_def } = make_class("Processor", 1, [
      "__call__",
    ]);
    const call_method_id = class_def.methods[0].symbol_id;
    const { id: var_id, def: var_def } = make_typed_variable(
      "processor",
      "Processor",
      10
    );

    const all_defs: AnyDefinition[] = [class_def, var_def];
    definitions.update_file(file_path, all_defs);
    set_test_resolutions(
      resolutions,
      module_scope,
      new Map([["Processor" as SymbolName, class_id]])
    );
    types.update_file(
      file_path,
      make_index(new Map([[var_id, var_def]]), new Map([[class_id, class_def]])),
      definitions,
      resolutions,
      empty_exports,
      empty_languages,
      empty_resolution
    );

    const result = resolve_callable_instance(var_id, definitions, types);
    expect(result).toEqual(call_method_id);
  });

  it("resolves an instance call to a __call__ inherited from a base class", () => {
    const { id: base_id, def: base_def } = make_class("BaseCallable", 1, [
      "__call__",
    ]);
    const call_method_id = base_def.methods[0].symbol_id;
    const { id: derived_id, def: derived_def } = make_class(
      "Handler",
      10,
      [],
      ["BaseCallable" as SymbolName]
    );
    const { id: var_id, def: var_def } = make_typed_variable(
      "handler",
      "Handler",
      20
    );

    definitions.update_file(file_path, [base_def, derived_def, var_def]);
    set_test_resolutions(
      resolutions,
      module_scope,
      new Map([
        ["BaseCallable" as SymbolName, base_id],
        ["Handler" as SymbolName, derived_id],
      ])
    );
    types.update_file(
      file_path,
      make_index(
        new Map([[var_id, var_def]]),
        new Map([
          [base_id, base_def],
          [derived_id, derived_def],
        ])
      ),
      definitions,
      resolutions,
      empty_exports,
      empty_languages,
      empty_resolution
    );

    const result = resolve_callable_instance(var_id, definitions, types);
    expect(result).toEqual(call_method_id);
  });

  it("resolves a constant instance call to __call__", () => {
    const { id: class_id, def: class_def } = make_class("Processor", 1, [
      "__call__",
    ]);
    const call_method_id = class_def.methods[0].symbol_id;

    const const_id = constant_symbol("PROCESSOR" as SymbolName, location(10));
    const const_def: VariableDefinition = {
      kind: "constant",
      symbol_id: const_id,
      name: "PROCESSOR" as SymbolName,
      location: location(10),
      defining_scope_id: module_scope,
      is_exported: false,
      type: "Processor" as SymbolName,
    };

    definitions.update_file(file_path, [class_def, const_def]);
    set_test_resolutions(
      resolutions,
      module_scope,
      new Map([["Processor" as SymbolName, class_id]])
    );
    types.update_file(
      file_path,
      make_index(
        new Map([[const_id, const_def]]),
        new Map([[class_id, class_def]])
      ),
      definitions,
      resolutions,
      empty_exports,
      empty_languages,
      empty_resolution
    );

    const result = resolve_callable_instance(const_id, definitions, types);
    expect(result).toEqual(call_method_id);
  });

  it("returns undefined when the variable's type has no __call__ method", () => {
    const { id: class_id, def: class_def } = make_class("Plain", 1, [
      "process",
    ]);
    const { id: var_id, def: var_def } = make_typed_variable(
      "obj",
      "Plain",
      10
    );

    definitions.update_file(file_path, [class_def, var_def]);
    set_test_resolutions(
      resolutions,
      module_scope,
      new Map([["Plain" as SymbolName, class_id]])
    );
    types.update_file(
      file_path,
      make_index(new Map([[var_id, var_def]]), new Map([[class_id, class_def]])),
      definitions,
      resolutions,
      empty_exports,
      empty_languages,
      empty_resolution
    );

    const result = resolve_callable_instance(var_id, definitions, types);
    expect(result).toBeUndefined();
  });

  it("returns undefined when the variable has no resolved type", () => {
    const { id: var_id, def: var_def } = make_typed_variable(
      "processor",
      "Processor",
      10
    );

    definitions.update_file(file_path, [var_def]);

    const result = resolve_callable_instance(var_id, definitions, types);
    expect(result).toBeUndefined();
  });

  it("returns undefined for a function definition", () => {
    const func_id = function_symbol("my_func" as SymbolName, location(1));
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "my_func" as SymbolName,
      location: location(1),
      defining_scope_id: module_scope,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "function:1:0" as ScopeId,
    };

    definitions.update_file(file_path, [func_def]);

    const result = resolve_callable_instance(func_id, definitions, types);
    expect(result).toBeUndefined();
  });

  it("returns undefined for a symbol absent from the definition registry", () => {
    const unknown_id = "variable:processor.py:1:0:1:10:missing" as SymbolId;

    const result = resolve_callable_instance(unknown_id, definitions, types);
    expect(result).toBeUndefined();
  });
});
