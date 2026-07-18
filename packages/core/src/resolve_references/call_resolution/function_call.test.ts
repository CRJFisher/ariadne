/**
 * Tests for resolve_function_call: binding a bare `foo()` call site to its
 * function definition, including path-qualified calls, method/constructor
 * skipping, collection dispatch, and the Python callable-instance protocol.
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
import { ResolutionRegistry } from "../resolution_registry";
import { set_test_resolutions, unwrap } from "../resolve_references.test";
import { create_function_call_reference } from "../../index_single_file/references/factories";
import {
  function_symbol,
  method_symbol,
  variable_symbol,
  class_symbol,
  namespace_symbol,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/index_single_file";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  Language,
  Result,
  ResolutionFailure,
  FunctionDefinition,
  MethodDefinition,
  VariableDefinition,
  ClassDefinition,
  NamespaceDefinition,
  LexicalScope,
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

function unwrap_err<T>(r: Result<T, ResolutionFailure>): ResolutionFailure {
  if (r.ok) {
    throw new Error(`Expected err, got ok: ${JSON.stringify(r.value)}`);
  }
  return r.error;
}

describe("Function Call Resolution", () => {
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

  describe("Resolves to function symbol", () => {
    it("resolves a bare function call to its function definition", () => {
      const func_id = function_symbol("greet" as SymbolName, MOCK_LOCATION);

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "greet" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        signature: { parameters: [] },
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [func_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("greet" as SymbolName, func_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "greet" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([func_id]);
    });
  });

  describe("Skips method/constructor", () => {
    it("skips a method and binds the same-name import in the outer scope", () => {
      const CLASS_SCOPE_ID = "scope:test.ts:class:2:0" as ScopeId;
      const METHOD_BODY_SCOPE_ID = "scope:test.ts:method:3:0" as ScopeId;

      const source_location: Location = {
        ...MOCK_LOCATION,
        file_path: "source.ts" as FilePath,
      };
      const import_func_id = function_symbol("do_work" as SymbolName, source_location);
      const method_id = method_symbol("do_work", MOCK_LOCATION);

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "do_work" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: METHOD_BODY_SCOPE_ID,
      };

      const import_func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: import_func_id,
        name: "do_work" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: source_location,
        signature: { parameters: [] },
        body_scope_id: "scope:source.ts:do_work:1:0" as ScopeId,
        is_exported: true,
      };

      definitions.update_file(TEST_FILE, [method_def]);
      definitions.update_file("source.ts" as FilePath, [import_func_def]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [CLASS_SCOPE_ID],
      });
      scope_map.set(CLASS_SCOPE_ID, {
        id: CLASS_SCOPE_ID,
        type: "class",
        location: MOCK_LOCATION,
        parent_id: FILE_SCOPE_ID,
        name: "Wrapper" as SymbolName,
        child_ids: [METHOD_BODY_SCOPE_ID],
      });
      scope_map.set(METHOD_BODY_SCOPE_ID, {
        id: METHOD_BODY_SCOPE_ID,
        type: "function",
        location: MOCK_LOCATION,
        parent_id: CLASS_SCOPE_ID,
        name: "do_work" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const scope_method_resolutions = new Map<SymbolName, SymbolId>();
      scope_method_resolutions.set("do_work" as SymbolName, method_id);
      set_test_resolutions(resolutions, METHOD_BODY_SCOPE_ID, scope_method_resolutions);

      const scope_file_resolutions = new Map<SymbolName, SymbolId>();
      scope_file_resolutions.set("do_work" as SymbolName, import_func_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_file_resolutions);

      const call_ref = create_function_call_reference(
        "do_work" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        METHOD_BODY_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([import_func_id]);
    });
  });

  describe("Unresolved cases", () => {
    it("fails with name_not_in_scope when the name is not found", () => {
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_function_call_reference(
        "undefined_func" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap_err(resolved)).toEqual({
        stage: "name_resolution",
        reason: "name_not_in_scope",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    });

    it("fails with definition_has_no_body_scope when a method has no body scope", () => {
      const method_id = method_symbol("do_work", MOCK_LOCATION);

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "do_work" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
      };

      definitions.update_file(TEST_FILE, [method_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("do_work" as SymbolName, method_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "do_work" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap_err(resolved)).toEqual({
        stage: "name_resolution",
        reason: "definition_has_no_body_scope",
        partial_info: { last_known_scope: FILE_SCOPE_ID },
      });
    });

    it("fails with no_parent_class when the method's class scope has no parent", () => {
      const ORPHAN_CLASS_SCOPE = "scope:test.ts:orphan_class:1:0" as ScopeId;
      const ORPHAN_METHOD_SCOPE = "scope:test.ts:orphan_method:2:0" as ScopeId;
      const method_id = method_symbol("do_work", MOCK_LOCATION);

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "do_work" as SymbolName,
        defining_scope_id: ORPHAN_CLASS_SCOPE,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: ORPHAN_METHOD_SCOPE,
      };

      definitions.update_file(TEST_FILE, [method_def]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(ORPHAN_CLASS_SCOPE, {
        id: ORPHAN_CLASS_SCOPE,
        type: "class",
        location: MOCK_LOCATION,
        parent_id: null,
        name: "Orphan" as SymbolName,
        child_ids: [ORPHAN_METHOD_SCOPE],
      });
      scope_map.set(ORPHAN_METHOD_SCOPE, {
        id: ORPHAN_METHOD_SCOPE,
        type: "function",
        location: MOCK_LOCATION,
        parent_id: ORPHAN_CLASS_SCOPE,
        name: "do_work" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      set_test_resolutions(
        resolutions,
        ORPHAN_METHOD_SCOPE,
        new Map([["do_work" as SymbolName, method_id]])
      );

      const call_ref = create_function_call_reference(
        "do_work" as SymbolName,
        MOCK_LOCATION,
        ORPHAN_METHOD_SCOPE
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap_err(resolved)).toEqual({
        stage: "name_resolution",
        reason: "no_parent_class",
        partial_info: {
          resolved_receiver_type: method_id,
          last_known_scope: ORPHAN_CLASS_SCOPE,
        },
      });
    });

    it("trusts a resolved symbol that has no registered definition", () => {
      const unknown_id = "function:test.ts:1:0:3:1:unknown" as SymbolId;

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("unknown" as SymbolName, unknown_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "unknown" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([unknown_id]);
    });
  });

  describe("Collection dispatch fallback", () => {
    it("resolves to every collection function when the variable has a collection_source", () => {
      // const CONFIG = new Map([["a", handlerA], ["b", handlerB]]);
      // const handler = CONFIG.get(key);  // handler.collection_source = "CONFIG"
      // handler();  // resolves to [handlerA, handlerB]

      const handler_a_id = function_symbol("handlerA" as SymbolName, MOCK_LOCATION);
      const handler_b_id = function_symbol("handlerB" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });
      const config_id = variable_symbol("CONFIG" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 1,
      });
      const handler_id = variable_symbol("handler" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 5,
      });

      const handler_a_def: FunctionDefinition = {
        kind: "function",
        symbol_id: handler_a_id,
        name: "handlerA" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        signature: { parameters: [] },
        body_scope_id: "scope:test.ts:handlerA:1:0" as ScopeId,
        is_exported: false,
      };

      const handler_b_def: FunctionDefinition = {
        kind: "function",
        symbol_id: handler_b_id,
        name: "handlerB" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 3 },
        signature: { parameters: [] },
        body_scope_id: "scope:test.ts:handlerB:3:0" as ScopeId,
        is_exported: false,
      };

      const config_def: VariableDefinition = {
        kind: "variable",
        symbol_id: config_id,
        name: "CONFIG" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        function_collection: {
          collection_id: config_id,
          collection_type: "Map",
          location: { ...MOCK_LOCATION, start_line: 1 },
          stored_functions: [handler_a_id, handler_b_id],
        },
      };

      const handler_def: VariableDefinition = {
        kind: "variable",
        symbol_id: handler_id,
        name: "handler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 5 },
        is_exported: false,
        collection_source: "CONFIG" as SymbolName,
      };

      definitions.update_file(TEST_FILE, [
        handler_a_def,
        handler_b_def,
        config_def,
        handler_def,
      ]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("handler" as SymbolName, handler_id);
      scope_resolutions.set("CONFIG" as SymbolName, config_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "handler" as SymbolName,
        { ...MOCK_LOCATION, start_line: 7 },
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([handler_a_id, handler_b_id]);
    });

    it("returns the direct resolution when the variable has no collection_source", () => {
      const func_id = function_symbol("process" as SymbolName, MOCK_LOCATION);

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "process" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        signature: { parameters: [] },
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [func_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("process" as SymbolName, func_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(unwrap(resolved)).toEqual([func_id]);
    });
  });

  describe("Python callable instance fallback", () => {
    it("resolves an instance call to the class __call__ method for .py files", () => {
      // processor = Processor()  # Processor has __call__
      // processor(data)          # resolves to Processor.__call__
      const py_file = "test.py" as FilePath;
      const py_scope = "scope:test.py:file:0:0" as ScopeId;
      const py_location: Location = {
        file_path: py_file,
        start_line: 5,
        start_column: 0,
        end_line: 5,
        end_column: 10,
      };

      const class_id = class_symbol("Processor" as SymbolName, {
        ...py_location,
        start_line: 1,
      });
      const call_method_id = method_symbol("__call__", {
        ...py_location,
        start_line: 2,
      });
      const var_id = variable_symbol("processor" as SymbolName, py_location);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Processor" as SymbolName,
        defining_scope_id: py_scope,
        location: { ...py_location, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [
          {
            kind: "method",
            symbol_id: call_method_id,
            name: "__call__" as SymbolName,
            defining_scope_id: py_scope,
            location: { ...py_location, start_line: 2 },
            parameters: [],
          },
        ],
        properties: [],
        decorators: [],
        constructors: [],
      };

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "processor" as SymbolName,
        defining_scope_id: py_scope,
        location: py_location,
        is_exported: false,
        type: "Processor" as SymbolName,
      };

      definitions.update_file(py_file, [class_def, var_def]);

      set_test_resolutions(
        resolutions,
        py_scope,
        new Map<SymbolName, SymbolId>([
          ["Processor" as SymbolName, class_id],
          ["processor" as SymbolName, var_id],
        ])
      );

      const py_index: SemanticIndex = {
        file_path: py_file,
        language: "python",
        root_scope_id: py_scope,
        scopes: new Map(),
        functions: new Map(),
        classes: new Map([[class_id, class_def]]),
        variables: new Map([[var_id, var_def]]),
        interfaces: new Map(),
        enums: new Map(),
        namespaces: new Map(),
        types: new Map(),
        imported_symbols: new Map(),
        references: [],
      };
      const { exports, languages, root_folder } = make_export_chain_context();
      types.update_file(
        py_file,
        py_index,
        definitions,
        resolutions,
        exports,
        languages,
        root_folder
      );

      const call_ref = create_function_call_reference(
        "processor" as SymbolName,
        { ...py_location, start_line: 10 },
        py_scope
      );

      const py_context = {
        ...context,
        languages: new Map<FilePath, Language>([[py_file, "python"]]),
      };
      const resolved = resolve_function_call(call_ref, py_context, resolutions);
      expect(unwrap(resolved)).toEqual([call_method_id]);
    });

    it("preserves the variable resolution when the type has no __call__ method", () => {
      const py_file = "test.py" as FilePath;
      const py_scope = "scope:test.py:file:0:0" as ScopeId;
      const py_location: Location = {
        file_path: py_file,
        start_line: 5,
        start_column: 0,
        end_line: 5,
        end_column: 10,
      };

      const var_id = variable_symbol("processor" as SymbolName, py_location);
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "processor" as SymbolName,
        defining_scope_id: py_scope,
        location: py_location,
        is_exported: false,
      };

      definitions.update_file(py_file, [var_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("processor" as SymbolName, var_id);
      set_test_resolutions(resolutions, py_scope, scope_resolutions);

      const call_ref = create_function_call_reference(
        "processor" as SymbolName,
        { ...py_location, start_line: 10 },
        py_scope
      );

      const py_context = {
        ...context,
        languages: new Map<FilePath, Language>([[py_file, "python"]]),
      };
      const resolved = resolve_function_call(call_ref, py_context, resolutions);
      expect(unwrap(resolved)).toEqual([var_id]);
    });

    it("does not attempt __call__ resolution for non-python files", () => {
      const var_id = variable_symbol("processor" as SymbolName, MOCK_LOCATION);
      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: var_id,
        name: "processor" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [var_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("processor" as SymbolName, var_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_function_call_reference(
        "processor" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID
      );

      const ts_context = {
        ...context,
        languages: new Map<FilePath, Language>([[TEST_FILE, "typescript"]]),
      };
      const resolved = resolve_function_call(call_ref, ts_context, resolutions);
      expect(unwrap(resolved)).toEqual([var_id]);
    });
  });
});
