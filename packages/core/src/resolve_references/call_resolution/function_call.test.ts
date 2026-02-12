/**
 * Tests for Function Call Resolution
 *
 * Verifies that resolve_function_call() correctly:
 * 1. Resolves bare function calls to function symbols
 * 2. Skips method/constructor definitions (they require receivers)
 * 3. Returns empty array for unresolved cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_function_call } from "./function_call";
import type { CallResolutionContext } from "./call_resolver";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ScopeRegistry } from "../registries/scope";
import { ReferenceRegistry } from "../registries/reference";
import { ImportGraph } from "../../project/import_graph";
import { ResolutionRegistry } from "../resolve_references";
import { set_test_resolutions } from "../resolve_references.test";
import { create_function_call_reference } from "../../index_single_file/references/factories";
import { function_symbol, method_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  FunctionDefinition,
  MethodDefinition,
  VariableDefinition,
  LexicalScope,
} from "@ariadnejs/types";

// Test fixtures
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
    context = { references, scopes, types, definitions, imports };
  });

  describe("Resolves to function symbol", () => {
    it("should resolve bare function call to function definition", () => {
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
      expect(resolved).toEqual([func_id]);
    });
  });

  describe("Skips method/constructor", () => {
    it("should skip method and find import in outer scope", () => {
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

      // Scope hierarchy: FILE -> CLASS -> METHOD_BODY
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

      // Resolve: method body -> method, file scope -> import
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
      expect(resolved).toEqual([import_func_id]);
    });
  });

  describe("Unresolved cases", () => {
    it("should return empty array when name not found", () => {
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_function_call_reference(
        "undefined_func" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(resolved).toEqual([]);
    });

    it("should return symbol when definition not in registry (trust unresolved)", () => {
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
      expect(resolved).toEqual([unknown_id]);
    });
  });

  describe("Collection dispatch fallback", () => {
    it("should resolve to collection functions when variable has collection_source", () => {
      // Setup:
      //   const CONFIG = new Map([["a", handlerA], ["b", handlerB]]);
      //   const handler = CONFIG.get(key);  // handler.collection_source = "CONFIG"
      //   handler();  // should resolve to [handlerA, handlerB]

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

      // Resolution: "handler" -> handler_id, "CONFIG" -> config_id
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
      expect(resolved).toEqual([handler_a_id, handler_b_id]);
    });

    it("should return direct resolution when variable has no collection_source", () => {
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
      expect(resolved).toEqual([func_id]);
    });
  });

  describe("Python callable instance fallback", () => {
    it("should attempt __call__ resolution for .py files with single resolved variable", () => {
      // Setup: processor = Processor()
      //        processor(data)  # Should try __call__ fallback
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

      // Without type bindings, callable instance returns undefined,
      // so the variable resolution is preserved
      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(resolved).toEqual([var_id]);
    });

    it("should not attempt __call__ for non-.py files", () => {
      // Same setup but with .ts file — should not enter callable instance path
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

      // For .ts files, callable instance path is not attempted
      const resolved = resolve_function_call(call_ref, context, resolutions);
      expect(resolved).toEqual([var_id]);
    });
  });
});
