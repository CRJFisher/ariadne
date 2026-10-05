import { describe, it, expect } from "vitest";
import {
  function_symbol,
  variable_symbol,
  type CollectionMember,
  type FilePath,
  type FunctionCollection,
  type Location,
  type ScopeId,
  type SymbolId,
  type SymbolName,
  type VariableDefinition,
} from "@ariadnejs/types";
import { attach_collection_members } from "./attach_collection_members";
import type { FunctionBuilderState } from "./builder_state";

const SCOPE = "module:test.ts:1:0:100:0:<module>" as ScopeId;

function loc(start_line: number, end_line: number = start_line + 2): Location {
  return {
    file_path: "test.ts" as FilePath,
    start_line,
    start_column: 0,
    end_line,
    end_column: 1,
  };
}

function make_variable(name: string, location: Location): VariableDefinition {
  return {
    kind: "variable",
    symbol_id: variable_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE,
    location,
    is_exported: false,
  };
}

function make_function_state(name: string, location: Location): FunctionBuilderState {
  return {
    base: {
      kind: "function",
      symbol_id: function_symbol(name as SymbolName, location),
      name: name as SymbolName,
      location,
    },
    signature: { parameters: new Map() },
    decorators: [],
  };
}

type InlineMember = Extract<CollectionMember, { symbol_id: SymbolId }>;

function inline_member(name: string, location: Location): InlineMember {
  return {
    name: name as SymbolName,
    symbol_id: function_symbol(name as SymbolName, location),
    location,
  };
}

describe("attach_collection_members", () => {
  it("folds member-assignment functions onto a matching variable holder", () => {
    const holder_loc = loc(1);
    const holder = make_variable("app", holder_loc);
    const variables = new Map<SymbolId, VariableDefinition>([[holder.symbol_id, holder]]);
    const member = inline_member("method", loc(5));

    attach_collection_members(
      new Map([["app" as SymbolName, [member]]]),
      variables,
      new Map(),
    );

    const expected: VariableDefinition = {
      kind: "variable",
      symbol_id: holder.symbol_id,
      name: "app" as SymbolName,
      defining_scope_id: SCOPE,
      location: holder_loc,
      is_exported: false,
      function_collection: {
        collection_id: holder.symbol_id,
        collection_type: "Object",
        location: holder_loc,
        stored_functions: [member.symbol_id],
        stored_references: undefined,
        named_members: [member],
      },
    };
    expect(variables.get(holder.symbol_id)).toEqual(expected);
  });

  it("merges assigned members into a holder's existing object-literal collection, preserving its type, location, and prior members", () => {
    const holder_loc = loc(1);
    const collection_loc = loc(1, 4);
    const prior_member = inline_member("existing", loc(2));
    const existing: FunctionCollection = {
      collection_id: variable_symbol("config" as SymbolName, holder_loc),
      collection_type: "Map",
      location: collection_loc,
      stored_functions: [prior_member.symbol_id],
      stored_references: ["ref" as SymbolName],
      named_members: [prior_member],
    };
    const holder: VariableDefinition = {
      ...make_variable("config", holder_loc),
      function_collection: existing,
    };
    const variables = new Map<SymbolId, VariableDefinition>([[holder.symbol_id, holder]]);
    const added = inline_member("added", loc(6));

    attach_collection_members(
      new Map([["config" as SymbolName, [added]]]),
      variables,
      new Map(),
    );

    const expected: FunctionCollection = {
      collection_id: holder.symbol_id,
      collection_type: "Map",
      location: collection_loc,
      stored_functions: [prior_member.symbol_id, added.symbol_id],
      stored_references: ["ref" as SymbolName],
      named_members: [prior_member, added],
    };
    expect(variables.get(holder.symbol_id)?.function_collection).toEqual(expected);
  });

  it("attaches to a constructor-function holder when no variable matches the name", () => {
    const holder_loc = loc(1);
    const fn_state = make_function_state("Fn", holder_loc);
    const holder_id = fn_state.base.symbol_id;
    const functions = new Map<SymbolId, FunctionBuilderState>([[holder_id!, fn_state]]);
    const member = inline_member("proto_method", loc(8));

    attach_collection_members(
      new Map([["Fn" as SymbolName, [member]]]),
      new Map(),
      functions,
    );

    const expected: FunctionCollection = {
      collection_id: holder_id!,
      collection_type: "Object",
      location: holder_loc,
      stored_functions: [member.symbol_id],
      stored_references: undefined,
      named_members: [member],
    };
    expect(functions.get(holder_id!)?.base.function_collection).toEqual(expected);
  });

  it("prefers a variable holder over a same-named function holder", () => {
    const shared_loc = loc(1);
    const variable = make_variable("shared", shared_loc);
    const fn_state = make_function_state("shared", loc(20));
    const variables = new Map<SymbolId, VariableDefinition>([[variable.symbol_id, variable]]);
    const functions = new Map<SymbolId, FunctionBuilderState>([
      [fn_state.base.symbol_id!, fn_state],
    ]);
    const member = inline_member("m", loc(5));

    attach_collection_members(
      new Map([["shared" as SymbolName, [member]]]),
      variables,
      functions,
    );

    expect(variables.get(variable.symbol_id)?.function_collection?.collection_id).toEqual(
      variable.symbol_id,
    );
    expect(functions.get(fn_state.base.symbol_id!)?.base.function_collection).toBeUndefined();
  });

  it("routes a reference-only member into named_members but not stored_functions", () => {
    const holder = make_variable("app", loc(1));
    const variables = new Map<SymbolId, VariableDefinition>([[holder.symbol_id, holder]]);
    const reference_member: CollectionMember = {
      name: "handle" as SymbolName,
      reference_name: "helper" as SymbolName,
    };

    attach_collection_members(
      new Map([["app" as SymbolName, [reference_member]]]),
      variables,
      new Map(),
    );

    const collection = variables.get(holder.symbol_id)?.function_collection;
    expect(collection?.stored_functions).toEqual([]);
    expect(collection?.named_members).toEqual([reference_member]);
  });

  it("leaves state untouched when the holder name matches neither a variable nor a function", () => {
    const holder = make_variable("app", loc(1));
    const variables = new Map<SymbolId, VariableDefinition>([[holder.symbol_id, holder]]);

    attach_collection_members(
      new Map([["ghost" as SymbolName, [inline_member("m", loc(5))]]]),
      variables,
      new Map(),
    );

    expect(variables.get(holder.symbol_id)).toEqual(holder);
  });

  it("skips a matched function holder whose base carries no symbol_id", () => {
    const partial_state: FunctionBuilderState = {
      base: { kind: "function", name: "Fn" as SymbolName, location: loc(1) },
      signature: { parameters: new Map() },
      decorators: [],
    };
    const key = function_symbol("Fn" as SymbolName, loc(1));
    const functions = new Map<SymbolId, FunctionBuilderState>([[key, partial_state]]);

    attach_collection_members(
      new Map([["Fn" as SymbolName, [inline_member("m", loc(5))]]]),
      new Map(),
      functions,
    );

    expect(functions.get(key)?.base.function_collection).toBeUndefined();
  });
});
