import { describe, it, expect, beforeEach } from "vitest";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { DefinitionRegistry } from "../registries/definition";
import { ResolutionRegistry } from "../resolution_registry";
import { set_test_resolutions } from "../resolve_references.test";
import {
  is_err,
  is_ok,
  variable_symbol,
  function_symbol,
} from "@ariadnejs/types";
import type {
  AnyDefinition,
  FilePath,
  FunctionCollection,
  Location,
  MethodCallReference,
  FunctionCallReference,
  ScopeId,
  SymbolId,
  SymbolName,
  VariableDefinition,
} from "@ariadnejs/types";

const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 10,
};

function fn_id(name: string): SymbolId {
  return function_symbol(name as SymbolName, MOCK_LOCATION);
}

function make_var_def(
  name: string,
  overrides: Partial<VariableDefinition> = {}
): { id: SymbolId; def: VariableDefinition } {
  const id = variable_symbol(name, MOCK_LOCATION);
  const def: VariableDefinition = {
    kind: "variable",
    symbol_id: id,
    name: name as SymbolName,
    defining_scope_id: FILE_SCOPE_ID,
    location: MOCK_LOCATION,
    is_exported: false,
    ...overrides,
  };
  return { id, def };
}

function function_call(name: string): FunctionCallReference {
  return {
    kind: "function_call",
    name: name as SymbolName,
    scope_id: FILE_SCOPE_ID,
    location: MOCK_LOCATION,
  };
}

function method_call(chain: string[]): MethodCallReference {
  return {
    kind: "method_call",
    name: chain[chain.length - 1] as SymbolName,
    property_chain: chain as SymbolName[],
    scope_id: FILE_SCOPE_ID,
    location: MOCK_LOCATION,
    receiver_location: MOCK_LOCATION,
    is_optional_chain: false,
  };
}

/** Registers definitions and wires each name to its id in the file scope. */
function register(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  defs: AnyDefinition[],
  scope: Record<string, SymbolId>
): void {
  definitions.update_file(TEST_FILE, defs);
  const scope_resolutions = new Map<SymbolName, SymbolId>();
  for (const [name, id] of Object.entries(scope)) {
    scope_resolutions.set(name as SymbolName, id);
  }
  set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);
}

describe("resolve_collection_dispatch", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("resolves a function call through a Map collection to every stored handler", () => {
    const handler1 = fn_id("handler1");
    const handler2 = fn_id("handler2");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("CONFIG", MOCK_LOCATION),
      collection_type: "Map",
      location: MOCK_LOCATION,
      stored_functions: [handler1, handler2],
    };
    const { id: config_id, def: config_def } = make_var_def("CONFIG", {
      kind: "constant",
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "CONFIG" as SymbolName,
    });

    register(definitions, resolutions, [config_def, handler_def], {
      CONFIG: config_id,
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("handler"),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([handler1, handler2]);
    }
  });

  it("resolves a method call by extracting the collection element from the receiver", () => {
    const process_a = fn_id("processA");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("HANDLERS", MOCK_LOCATION),
      collection_type: "Array",
      location: MOCK_LOCATION,
      stored_functions: [process_a],
    };
    const { id: handlers_id, def: handlers_def } = make_var_def("HANDLERS", {
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "HANDLERS" as SymbolName,
    });

    register(definitions, resolutions, [handlers_def, handler_def], {
      HANDLERS: handlers_id,
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      method_call(["handler", "process"]),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([process_a]);
    }
  });

  it("resolves stored_references by name and appends them to stored_functions", () => {
    const stored = fn_id("storedFn");
    const referenced_id = fn_id("referencedFn");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("CALLBACKS", MOCK_LOCATION),
      collection_type: "Array",
      location: MOCK_LOCATION,
      stored_functions: [stored],
      stored_references: ["referencedFn" as SymbolName],
    };
    const { id: callbacks_id, def: callbacks_def } = make_var_def("CALLBACKS", {
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("cb", {
      collection_source: "CALLBACKS" as SymbolName,
    });

    register(definitions, resolutions, [callbacks_def, handler_def], {
      CALLBACKS: callbacks_id,
      cb: handler_id,
      referencedFn: referenced_id,
    });

    const result = resolve_collection_dispatch(
      function_call("cb"),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([stored, referenced_id]);
    }
  });

  it("skips stored_references that do not resolve in the defining scope", () => {
    const stored = fn_id("storedFn");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("CALLBACKS", MOCK_LOCATION),
      collection_type: "Array",
      location: MOCK_LOCATION,
      stored_functions: [stored],
      stored_references: ["unknownFn" as SymbolName],
    };
    const { id: callbacks_id, def: callbacks_def } = make_var_def("CALLBACKS", {
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("cb", {
      collection_source: "CALLBACKS" as SymbolName,
    });

    register(definitions, resolutions, [callbacks_def, handler_def], {
      CALLBACKS: callbacks_id,
      cb: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("cb"),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([stored]);
    }
  });

  it("fails with collection_dispatch_miss when the collection is empty", () => {
    const collection: FunctionCollection = {
      collection_id: variable_symbol("EMPTY", MOCK_LOCATION),
      collection_type: "Map",
      location: MOCK_LOCATION,
      stored_functions: [],
    };
    const { id: empty_id, def: empty_def } = make_var_def("EMPTY", {
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "EMPTY" as SymbolName,
    });

    register(definitions, resolutions, [empty_def, handler_def], {
      EMPTY: empty_id,
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("handler"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "collection_dispatch_miss",
        partial_info: { resolved_receiver_type: empty_id },
      });
    }
  });

  it("fails with collection_dispatch_miss when collection_source points to a variable holding no collection", () => {
    const { id: plain_id, def: plain_def } = make_var_def("plainCollection");
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "plainCollection" as SymbolName,
    });

    register(definitions, resolutions, [plain_def, handler_def], {
      plainCollection: plain_id,
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("handler"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "collection_dispatch_miss",
        partial_info: { resolved_receiver_type: plain_id },
      });
    }
  });

  it("fails with name_not_in_scope when collection_source cannot be resolved", () => {
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "MISSING" as SymbolName,
    });

    register(definitions, resolutions, [handler_def], {
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("handler"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "name_resolution",
        reason: "name_not_in_scope",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    }
  });

  it("fails with name_not_in_scope when the target name resolves to nothing", () => {
    const result = resolve_collection_dispatch(
      function_call("unknown"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "name_resolution",
        reason: "name_not_in_scope",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    }
  });

  it("fails with collection_dispatch_miss when the target resolves to an id with no definition", () => {
    const dangling_id = variable_symbol("dangling", MOCK_LOCATION);

    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("dangling" as SymbolName, dangling_id);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const result = resolve_collection_dispatch(
      function_call("dangling"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "collection_dispatch_miss",
        partial_info: {
          resolved_receiver_type: dangling_id,
          last_known_scope: FILE_SCOPE_ID,
        },
      });
    }
  });

  it("fails with collection_dispatch_miss when the target is a plain variable with no collection_source", () => {
    const { id: plain_id, def: plain_def } = make_var_def("plain");

    register(definitions, resolutions, [plain_def], { plain: plain_id });

    const result = resolve_collection_dispatch(
      method_call(["plain", "fn"]),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "collection_dispatch_miss",
        partial_info: { resolved_receiver_type: plain_id },
      });
    }
  });

  it("fails with collection_dispatch_miss when the target is a function definition rather than a variable", () => {
    const do_thing_id = fn_id("doThing");
    const fn_def: AnyDefinition = {
      kind: "function",
      symbol_id: do_thing_id,
      name: "doThing" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: FILE_SCOPE_ID,
    };

    register(definitions, resolutions, [fn_def], { doThing: do_thing_id });

    const result = resolve_collection_dispatch(
      function_call("doThing"),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "collection_dispatch_miss",
        partial_info: { resolved_receiver_type: do_thing_id },
      });
    }
  });

  it("fails with dynamic_dispatch when a method call has no extractable receiver name", () => {
    const result = resolve_collection_dispatch(
      method_call(["go"]),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "dynamic_dispatch",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    }
  });

  it("fails with dynamic_dispatch for reference kinds that are neither function nor method calls", () => {
    const result = resolve_collection_dispatch(
      {
        kind: "variable_reference",
        name: "x" as SymbolName,
        scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        access_type: "read",
      },
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
    if (is_err(result)) {
      expect(result.error).toEqual({
        stage: "collection_dispatch",
        reason: "dynamic_dispatch",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    }
  });

  it("returns nested-collection element ids verbatim without recursing", () => {
    const inner_collection_var = variable_symbol("INNER", MOCK_LOCATION);
    const collection: FunctionCollection = {
      collection_id: variable_symbol("OUTER", MOCK_LOCATION),
      collection_type: "Array",
      location: MOCK_LOCATION,
      stored_functions: [inner_collection_var],
    };
    const { id: outer_id, def: outer_def } = make_var_def("OUTER", {
      function_collection: collection,
    });
    const { id: handler_id, def: handler_def } = make_var_def("handler", {
      collection_source: "OUTER" as SymbolName,
    });

    register(definitions, resolutions, [outer_def, handler_def], {
      OUTER: outer_id,
      handler: handler_id,
    });

    const result = resolve_collection_dispatch(
      function_call("handler"),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([inner_collection_var]);
    }
  });

  it("resolves a keyed object-property alias to only the named nested member", () => {
    const target = fn_id("target");
    const decoy = fn_id("decoy");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("Ns", MOCK_LOCATION),
      collection_type: "Object",
      location: MOCK_LOCATION,
      stored_functions: [],
      named_members: [
        { name: "A" as SymbolName, nested: [{ name: "prop" as SymbolName, reference_name: "target" as SymbolName }] },
        { name: "B" as SymbolName, nested: [{ name: "prop" as SymbolName, reference_name: "decoy" as SymbolName }] },
      ],
    };
    const { id: ns_id, def: ns_def } = make_var_def("Ns", {
      kind: "constant",
      function_collection: collection,
    });
    const { id: alias_id, def: alias_def } = make_var_def("A", {
      collection_source: "Ns" as SymbolName,
      collection_source_key: "A" as SymbolName,
    });

    register(definitions, resolutions, [ns_def, alias_def], {
      Ns: ns_id,
      A: alias_id,
      target,
      decoy,
    });

    const result = resolve_collection_dispatch(
      method_call(["A", "prop"]),
      definitions,
      resolutions
    );

    expect(is_ok(result)).toBe(true);
    if (is_ok(result)) {
      expect(result.value).toEqual([target]);
    }
  });

  it("fails a keyed alias whose key is absent rather than unioning the collection", () => {
    const target = fn_id("target");
    const collection: FunctionCollection = {
      collection_id: variable_symbol("Ns", MOCK_LOCATION),
      collection_type: "Object",
      location: MOCK_LOCATION,
      stored_functions: [target],
      named_members: [
        { name: "A" as SymbolName, nested: [{ name: "prop" as SymbolName, reference_name: "target" as SymbolName }] },
      ],
    };
    const { id: ns_id, def: ns_def } = make_var_def("Ns", {
      kind: "constant",
      function_collection: collection,
    });
    const { id: alias_id, def: alias_def } = make_var_def("A", {
      collection_source: "Ns" as SymbolName,
      collection_source_key: "A" as SymbolName,
    });

    register(definitions, resolutions, [ns_def, alias_def], {
      Ns: ns_id,
      A: alias_id,
      target,
    });

    const result = resolve_collection_dispatch(
      method_call(["A", "missing"]),
      definitions,
      resolutions
    );

    expect(is_err(result)).toBe(true);
  });
});
