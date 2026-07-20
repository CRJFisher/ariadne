import { describe, it, expect } from "vitest";
import { detect_indirect_reachability } from "./indirect_reachability";
import { function_symbol, method_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  FilePath,
  Location,
  FunctionCollection,
  IndirectReachability,
  AnyDefinition,
  ScopeId,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
  VariableDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";

const TEST_FILE = "test.ts" as FilePath;
const SCOPE_FILE = "scope:test.ts:file:0:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 0,
  end_line: 1,
  end_column: 10,
};

const READ_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 10,
};

type ReadRef = {
  kind: string;
  access_type?: string;
  scope_id: string;
  name: SymbolName;
  location: Location;
};

function read_ref(
  name: string,
  location: Location,
  overrides: Partial<ReadRef> = {},
): ReadRef {
  return {
    kind: "variable_reference",
    access_type: "read",
    scope_id: SCOPE_FILE,
    name: name as SymbolName,
    location,
    ...overrides,
  };
}

function name_resolver(
  by_name: Record<string, SymbolId>,
): (scope_id: string, name: SymbolName) => SymbolId | null {
  return (_scope_id, name) => by_name[name as string] ?? null;
}

function run(
  refs: ReadRef[],
  registry: DefinitionRegistry,
  resolve: (scope_id: string, name: SymbolName) => SymbolId | null,
): Map<SymbolId, IndirectReachability> {
  const file_references = new Map<FilePath, readonly ReadRef[]>([[TEST_FILE, refs]]);
  return detect_indirect_reachability(file_references, registry, resolve);
}

function make_function_def(name: string, location: Location): FunctionDefinition {
  return {
    kind: "function",
    symbol_id: function_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE_FILE,
    location,
    is_exported: false,
    signature: { parameters: [] },
    body_scope_id: `scope:test.ts:function:${location.start_line}:${location.start_column}` as ScopeId,
  };
}

function make_method_def(name: string, location: Location): MethodDefinition {
  return {
    kind: "method",
    symbol_id: method_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE_FILE,
    location,
    parameters: [],
    body_scope_id: `scope:test.ts:method:${location.start_line}:${location.start_column}` as ScopeId,
  };
}

// Constructors reuse method_symbol for their id (see capture_handlers.javascript.ts).
function make_constructor_def(name: string, location: Location): ConstructorDefinition {
  return {
    kind: "constructor",
    symbol_id: method_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE_FILE,
    location,
    parameters: [],
    body_scope_id: `scope:test.ts:constructor:${location.start_line}:${location.start_column}` as ScopeId,
  };
}

function make_variable_def(
  name: string,
  location: Location,
  function_collection?: FunctionCollection,
): VariableDefinition {
  return {
    kind: "variable",
    symbol_id: variable_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE_FILE,
    location,
    is_exported: false,
    function_collection,
  };
}

function mock_definition_registry(
  defs: Map<SymbolId, AnyDefinition>,
  collections: Map<SymbolId, FunctionCollection> = new Map(),
): DefinitionRegistry {
  return {
    get: (symbol_id: SymbolId) => defs.get(symbol_id),
    get_function_collection: (symbol_id: SymbolId) => collections.get(symbol_id),
  } as Partial<DefinitionRegistry> as DefinitionRegistry;
}

describe("detect_indirect_reachability", () => {
  it("returns an empty map when there are no references", () => {
    const registry = mock_definition_registry(new Map());
    const result = detect_indirect_reachability(new Map(), registry, () => null);
    expect(result).toEqual(new Map());
  });

  describe("function reference detection", () => {
    it("marks a function read as a value as a function_reference", () => {
      const fn_def = make_function_def("doubler", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]),
      );

      const result = run(
        [read_ref("doubler", READ_LOCATION)],
        registry,
        name_resolver({ doubler: fn_def.symbol_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            fn_def.symbol_id,
            { reason: { type: "function_reference", read_location: READ_LOCATION } },
          ],
        ]),
      );
    });

    it("does not mark a non-function variable read", () => {
      const var_def = make_variable_def("counter", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[var_def.symbol_id, var_def]]),
      );

      const result = run(
        [read_ref("counter", READ_LOCATION)],
        registry,
        name_resolver({ counter: var_def.symbol_id }),
      );

      expect(result).toEqual(new Map());
    });

    it("does not mark a write access to a function name", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]),
      );

      const result = run(
        [read_ref("handler", READ_LOCATION, { access_type: "write" })],
        registry,
        name_resolver({ handler: fn_def.symbol_id }),
      );

      expect(result).toEqual(new Map());
    });

    it("marks each of several function reads with its own read location", () => {
      const fn_a = make_function_def("doubler", MOCK_LOCATION);
      const loc_b: Location = { ...MOCK_LOCATION, start_line: 3, end_line: 3 };
      const fn_b = make_function_def("tripler", loc_b);
      const read_loc_b: Location = { ...READ_LOCATION, start_line: 6, end_line: 6 };
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([
          [fn_a.symbol_id, fn_a],
          [fn_b.symbol_id, fn_b],
        ]),
      );

      const result = run(
        [read_ref("doubler", READ_LOCATION), read_ref("tripler", read_loc_b)],
        registry,
        name_resolver({ doubler: fn_a.symbol_id, tripler: fn_b.symbol_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            fn_a.symbol_id,
            { reason: { type: "function_reference", read_location: READ_LOCATION } },
          ],
          [
            fn_b.symbol_id,
            { reason: { type: "function_reference", read_location: read_loc_b } },
          ],
        ]),
      );
    });

    it("skips references that are not variable_reference kinds", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]),
      );

      const result = run(
        [read_ref("handler", READ_LOCATION, { kind: "function_call" })],
        registry,
        name_resolver({ handler: fn_def.symbol_id }),
      );

      expect(result).toEqual(new Map());
    });

    it("skips a name that does not resolve to a symbol", () => {
      const registry = mock_definition_registry(new Map());

      const result = run([read_ref("ghost", READ_LOCATION)], registry, () => null);

      expect(result).toEqual(new Map());
    });

    it("skips a resolved symbol that has no definition", () => {
      const orphan_id = function_symbol("orphan" as SymbolName, MOCK_LOCATION);
      const registry = mock_definition_registry(new Map());

      const result = run(
        [read_ref("orphan", READ_LOCATION)],
        registry,
        name_resolver({ orphan: orphan_id }),
      );

      expect(result).toEqual(new Map());
    });
  });

  describe("method reference detection", () => {
    it("marks a method read as a value as a function_reference", () => {
      const method_def = make_method_def("on_node_start", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[method_def.symbol_id, method_def]]),
      );

      const result = run(
        [read_ref("on_node_start", READ_LOCATION)],
        registry,
        name_resolver({ on_node_start: method_def.symbol_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            method_def.symbol_id,
            { reason: { type: "function_reference", read_location: READ_LOCATION } },
          ],
        ]),
      );
    });

    it("skips a method read at its own definition site", () => {
      const method_def = make_method_def("process", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[method_def.symbol_id, method_def]]),
      );

      const result = run(
        [read_ref("process", MOCK_LOCATION)],
        registry,
        name_resolver({ process: method_def.symbol_id }),
      );

      expect(result).toEqual(new Map());
    });

    it("does not mark a constructor read as a value", () => {
      const ctor_def = make_constructor_def("constructor", MOCK_LOCATION);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[ctor_def.symbol_id, ctor_def]]),
      );

      const result = run(
        [read_ref("constructor", READ_LOCATION)],
        registry,
        name_resolver({ constructor: ctor_def.symbol_id }),
      );

      expect(result).toEqual(new Map());
    });
  });

  describe("collection read detection", () => {
    it("marks inline stored functions as collection_read", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const collection_loc: Location = { ...MOCK_LOCATION, start_line: 10, end_line: 10 };
      const collection_id = variable_symbol("HANDLERS" as SymbolName, collection_loc);
      const collection: FunctionCollection = {
        collection_id,
        collection_type: "Array",
        location: collection_loc,
        stored_functions: [fn_def.symbol_id],
      };
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]),
        new Map<SymbolId, FunctionCollection>([[collection_id, collection]]),
      );

      const result = run(
        [read_ref("HANDLERS", READ_LOCATION)],
        registry,
        name_resolver({ HANDLERS: collection_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            fn_def.symbol_id,
            {
              reason: { type: "collection_read", collection_id, read_location: READ_LOCATION },
            },
          ],
        ]),
      );
    });

    it("marks a function referenced by name in a collection as collection_read", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const collection_loc: Location = { ...MOCK_LOCATION, start_line: 10, end_line: 10 };
      const collection_id = variable_symbol("HANDLERS" as SymbolName, collection_loc);
      const collection_def = make_variable_def("HANDLERS", collection_loc);
      const collection: FunctionCollection = {
        collection_id,
        collection_type: "Array",
        location: collection_loc,
        stored_functions: [],
        stored_references: ["handler" as SymbolName],
      };
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([
          [fn_def.symbol_id, fn_def],
          [collection_id, collection_def],
        ]),
        new Map<SymbolId, FunctionCollection>([[collection_id, collection]]),
      );

      const result = run(
        [read_ref("HANDLERS", READ_LOCATION)],
        registry,
        name_resolver({ HANDLERS: collection_id, handler: fn_def.symbol_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            fn_def.symbol_id,
            {
              reason: { type: "collection_read", collection_id, read_location: READ_LOCATION },
            },
          ],
        ]),
      );
    });

    it("recurses into a spread collection and keys reachability on the inner collection", () => {
      const inner_fn = make_function_def("inner_handler", MOCK_LOCATION);
      const inner_loc: Location = { ...MOCK_LOCATION, start_line: 8, end_line: 8 };
      const inner_id = variable_symbol("INNER" as SymbolName, inner_loc);
      const inner_collection: FunctionCollection = {
        collection_id: inner_id,
        collection_type: "Array",
        location: inner_loc,
        stored_functions: [inner_fn.symbol_id],
      };
      const inner_def = make_variable_def("INNER", inner_loc, inner_collection);

      const outer_loc: Location = { ...MOCK_LOCATION, start_line: 10, end_line: 10 };
      const outer_id = variable_symbol("OUTER" as SymbolName, outer_loc);
      const outer_collection: FunctionCollection = {
        collection_id: outer_id,
        collection_type: "Array",
        location: outer_loc,
        stored_functions: [],
        stored_references: ["INNER" as SymbolName],
      };
      const outer_def = make_variable_def("OUTER", outer_loc, outer_collection);

      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([
          [inner_fn.symbol_id, inner_fn],
          [inner_id, inner_def],
          [outer_id, outer_def],
        ]),
        new Map<SymbolId, FunctionCollection>([[outer_id, outer_collection]]),
      );

      const result = run(
        [read_ref("OUTER", READ_LOCATION)],
        registry,
        name_resolver({ OUTER: outer_id, INNER: inner_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            inner_fn.symbol_id,
            {
              reason: {
                type: "collection_read",
                collection_id: inner_id,
                read_location: READ_LOCATION,
              },
            },
          ],
        ]),
      );
    });

    it("terminates on a self-referencing collection without re-processing it", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const collection_loc: Location = { ...MOCK_LOCATION, start_line: 10, end_line: 10 };
      const collection_id = variable_symbol("HANDLERS" as SymbolName, collection_loc);
      const collection: FunctionCollection = {
        collection_id,
        collection_type: "Array",
        location: collection_loc,
        stored_functions: [fn_def.symbol_id],
        stored_references: ["HANDLERS" as SymbolName],
      };
      const collection_def = make_variable_def("HANDLERS", collection_loc, collection);
      const registry = mock_definition_registry(
        new Map<SymbolId, AnyDefinition>([
          [fn_def.symbol_id, fn_def],
          [collection_id, collection_def],
        ]),
        new Map<SymbolId, FunctionCollection>([[collection_id, collection]]),
      );

      const result = run(
        [read_ref("HANDLERS", READ_LOCATION)],
        registry,
        name_resolver({ HANDLERS: collection_id, handler: fn_def.symbol_id }),
      );

      expect(result).toEqual(
        new Map<SymbolId, IndirectReachability>([
          [
            fn_def.symbol_id,
            {
              reason: { type: "collection_read", collection_id, read_location: READ_LOCATION },
            },
          ],
        ]),
      );
    });
  });
});
