/**
 * Tests for the Rust qualified-call leaf: binding a `::`-qualified call through
 * its type or module qualifier, over same-name local shadows.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { make_export_chain_context } from "../resolution_test_helpers";
import { resolve_function_call } from "./function_call";
import type { CallResolutionContext } from "./call_resolver";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ScopeRegistry } from "../registries/scope";
import { ReferenceRegistry } from "../registries/reference";
import { ImportGraph } from "../import_resolution/import_graph";
import { ResolutionRegistry } from "../resolve_references";
import { set_test_resolutions, unwrap } from "../resolve_references.test";
import { create_function_call_reference } from "../../index_single_file/references/factories";
import {
  function_symbol,
  method_symbol,
  class_symbol,
  namespace_symbol,
} from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  MethodDefinition,
  ClassDefinition,
  NamespaceDefinition,
  LexicalScope,
  FunctionDefinition,
} from "@ariadnejs/types";

const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const FUNC_SCOPE_ID = "scope:test.ts:func:1:0" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 0,
  end_line: 5,
  end_column: 10,
};

describe("Rust Qualified-Call Resolution", () => {
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let scopes: ScopeRegistry;
  let references: ReferenceRegistry;
  let imports: ImportGraph;
  let context: CallResolutionContext;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    scopes = new ScopeRegistry();
    references = new ReferenceRegistry();
    imports = new ImportGraph();
    resolutions = new ResolutionRegistry();
    context = { references, scopes, types, definitions, imports, resolutions, ...make_export_chain_context() };
  });

  describe("Path-qualified calls", () => {
    it("binds a type-qualified associated function over a same-name local", () => {
      const CLASS_SCOPE_ID = "scope:test.ts:class:1:0" as ScopeId;
      const class_id = class_symbol("Parker" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 1,
      });
      const make_method_id = method_symbol("make", {
        ...MOCK_LOCATION,
        start_line: 2,
      });
      const local_make_id = function_symbol("make" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 8,
      });

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Parker" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [
          {
            kind: "method",
            symbol_id: make_method_id,
            name: "make" as SymbolName,
            defining_scope_id: CLASS_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2 },
            parameters: [],
          },
        ],
        properties: [],
        decorators: [],
        constructors: [],
      };

      const local_make_def: FunctionDefinition = {
        kind: "function",
        symbol_id: local_make_id,
        name: "make" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 8 },
        signature: { parameters: [] },
        body_scope_id: "scope:test.ts:make:8:0" as ScopeId,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [class_def, local_make_def]);

      set_test_resolutions(
        resolutions,
        FILE_SCOPE_ID,
        new Map<SymbolName, SymbolId>([
          ["Parker" as SymbolName, class_id],
          ["make" as SymbolName, local_make_id],
        ])
      );

      const call_ref = create_function_call_reference(
        "make" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID,
        undefined,
        ["Parker"] as SymbolName[]
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([make_method_id]);
    });

    it("binds a module-qualified call through the module body scope", () => {
      const MODULE_SCOPE_ID = "scope:test.ts:module:1:0" as ScopeId;
      const worker_ns_id = namespace_symbol("worker", {
        ...MOCK_LOCATION,
        start_line: 1,
      });
      const create_id = function_symbol("create" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 2,
      });

      const worker_ns_def: NamespaceDefinition = {
        kind: "namespace",
        symbol_id: worker_ns_id,
        name: "worker" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
      };

      const create_def: FunctionDefinition = {
        kind: "function",
        symbol_id: create_id,
        name: "create" as SymbolName,
        defining_scope_id: MODULE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        signature: { parameters: [] },
        body_scope_id: "scope:test.ts:create:2:0" as ScopeId,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [worker_ns_def, create_def]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [MODULE_SCOPE_ID],
      });
      scope_map.set(MODULE_SCOPE_ID, {
        id: MODULE_SCOPE_ID,
        type: "module",
        location: { ...MOCK_LOCATION, start_line: 1 },
        parent_id: FILE_SCOPE_ID,
        name: "worker" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      set_test_resolutions(
        resolutions,
        FILE_SCOPE_ID,
        new Map<SymbolName, SymbolId>([["worker" as SymbolName, worker_ns_id]])
      );

      const call_ref = create_function_call_reference(
        "create" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID,
        undefined,
        ["worker"] as SymbolName[]
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([create_id]);
    });

    it("falls back to bare resolution when the path prefix misses", () => {
      const helper_id = function_symbol("helper" as SymbolName, MOCK_LOCATION);

      const helper_def: FunctionDefinition = {
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        signature: { parameters: [] },
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [helper_def]);

      set_test_resolutions(
        resolutions,
        FILE_SCOPE_ID,
        new Map<SymbolName, SymbolId>([["helper" as SymbolName, helper_id]])
      );

      const call_ref = create_function_call_reference(
        "helper" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID,
        undefined,
        ["Unknown"] as SymbolName[]
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([helper_id]);
    });
  });
});
