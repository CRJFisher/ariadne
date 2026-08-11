/**
 * Tests for resolve_callable_values: turning a callable handed somewhere by
 * name (`app.get("/", user.list)`, `defineGetter(req, "query", function query(){})`)
 * into indirect-reachability evidence, never a call edge.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { make_export_chain_context } from "../resolution_test_helpers";
import { resolve_callable_values } from "./callable_value";
import type { CallResolutionContext } from "./call_resolver";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ScopeRegistry } from "../registries/scope";
import { ReferenceRegistry } from "../registries/reference";
import { ImportGraph } from "../import_resolution/import_graph";
import { ResolutionRegistry } from "../resolution_registry";
import {
  create_callable_value_reference,
  create_variable_reference,
} from "../../index_single_file/references/factories";
import { class_symbol, function_symbol } from "@ariadnejs/types";
import type {
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  FunctionDefinition,
  SymbolReference,
} from "@ariadnejs/types";

const TEST_FILE = "test.js" as FilePath;
const FILE_SCOPE_ID = "scope:test.js:file:0:0" as ScopeId;
const BODY_SCOPE_ID = "scope:test.js:func:1:0" as ScopeId;

/** The location of the handler's own name node — where its definition sits. */
const HANDLER_NAME_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 1,
  start_column: 9,
  end_line: 1,
  end_column: 16,
};

const READ_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 7,
  start_column: 20,
  end_line: 7,
  end_column: 27,
};

function make_function(name: string, location: Location): FunctionDefinition {
  return {
    kind: "function",
    symbol_id: function_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: FILE_SCOPE_ID,
    location,
    signature: { parameters: [] },
    body_scope_id: BODY_SCOPE_ID,
    is_exported: false,
  };
}

function file_references(
  references: readonly SymbolReference[]
): Map<FilePath, readonly SymbolReference[]> {
  return new Map([[TEST_FILE, references]]);
}

describe("resolve_callable_values", () => {
  let context: CallResolutionContext;
  let definitions: DefinitionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    context = {
      references: new ReferenceRegistry(),
      scopes: new ScopeRegistry(),
      types: new TypeRegistry(),
      definitions,
      imports: new ImportGraph(),
      resolutions: new ResolutionRegistry(),
      ...make_export_chain_context(),
    };
  });

  it("marks a named function expression reachable from its own name node", () => {
    const handler = make_function("handler", HANDLER_NAME_LOCATION);
    definitions.update_file(TEST_FILE, [handler]);

    const reachable = resolve_callable_values(
      file_references([
        create_callable_value_reference(
          "handler" as SymbolName,
          HANDLER_NAME_LOCATION,
          FILE_SCOPE_ID,
          ["handler" as SymbolName]
        ),
      ]),
      context
    );

    expect([...reachable.keys()]).toEqual([handler.symbol_id]);
    expect(reachable.get(handler.symbol_id)).toEqual({
      reason: {
        type: "function_reference",
        read_location: HANDLER_NAME_LOCATION,
      },
    });
  });

  it("marks nothing for a single-element chain that is not a definition's name node", () => {
    // `register(getHelper().handler)` leaves the bare name `handler`. Binding
    // it by name would reach an unrelated module-scope `handler` and silently
    // drop it from the entry-point list.
    const unrelated = make_function("handler", HANDLER_NAME_LOCATION);
    definitions.update_file(TEST_FILE, [unrelated]);

    const reachable = resolve_callable_values(
      file_references([
        create_callable_value_reference(
          "handler" as SymbolName,
          READ_LOCATION,
          FILE_SCOPE_ID,
          ["handler" as SymbolName]
        ),
      ]),
      context
    );

    expect([...reachable.keys()]).toEqual([]);
  });

  it("marks nothing for a member chain whose receiver resolves to no type", () => {
    definitions.update_file(TEST_FILE, [
      make_function("list", HANDLER_NAME_LOCATION),
    ]);

    const reachable = resolve_callable_values(
      file_references([
        create_callable_value_reference(
          "list" as SymbolName,
          READ_LOCATION,
          FILE_SCOPE_ID,
          ["user" as SymbolName, "list" as SymbolName],
          READ_LOCATION
        ),
      ]),
      context
    );

    expect([...reachable.keys()]).toEqual([]);
  });

  it("ignores references that are not callable values", () => {
    const handler = make_function("handler", HANDLER_NAME_LOCATION);
    definitions.update_file(TEST_FILE, [handler]);

    const reachable = resolve_callable_values(
      file_references([
        create_variable_reference(
          "handler" as SymbolName,
          HANDLER_NAME_LOCATION,
          FILE_SCOPE_ID,
          "read"
        ),
      ]),
      context
    );

    expect([...reachable.keys()]).toEqual([]);
  });

  it("keeps a class definition out of the reachable set", () => {
    // Only functions and methods are callable values; a class handed by name
    // is a constructor reference and resolves through its own path.
    const class_location: Location = {
      file_path: TEST_FILE,
      start_line: 2,
      start_column: 6,
      end_line: 2,
      end_column: 11,
    };
    const class_symbol_id = class_symbol("Klass" as SymbolName, class_location);
    definitions.update_file(TEST_FILE, [
      {
        kind: "class",
        symbol_id: class_symbol_id,
        name: "Klass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: class_location,
        is_exported: false,
        methods: [],
        properties: [],
        extends: [],
        decorators: [],
      },
    ]);

    const reachable = resolve_callable_values(
      file_references([
        create_callable_value_reference(
          "Klass" as SymbolName,
          class_location,
          FILE_SCOPE_ID,
          ["Klass" as SymbolName]
        ),
      ]),
      context
    );

    expect([...reachable.keys()]).toEqual([]);
  });
});
