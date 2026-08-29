/**
 * Tests the call resolver coordinator: driving unresolved references of each
 * call kind through `resolve_calls_for_files` and asserting the resolved edges,
 * groupings, and type-registry side effects it produces.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { make_export_chain_context } from "../resolution_test_helpers";
import { Project } from "../../project/project";
import {
  resolve_calls_for_files,
  type CallResolutionContext,
} from "./call_resolver";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ScopeRegistry } from "../registries/scope";
import { ReferenceRegistry } from "../registries/reference";
import { ImportGraph } from "../import_resolution/import_graph";
import { ResolutionRegistry } from "../resolution_registry";
import { set_test_resolutions } from "../resolve_references.test";
import { create_method_call_reference, create_constructor_call_reference } from "../../index_single_file/references/factories";
import {
  function_symbol,
  method_symbol,
  class_symbol,
  variable_symbol,
  anonymous_function_symbol,
} from "@ariadnejs/types";
import type {
  FilePath,
  ScopeId,
  SymbolId,
  SymbolName,
  Location,
  FunctionDefinition,
  CallableDefinition,
  MethodDefinition,
  ClassDefinition,
  ConstructorDefinition,
  VariableDefinition,
  FunctionCallReference,
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

describe("resolve_calls_for_files", () => {
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let scopes: ScopeRegistry;
  let references: ReferenceRegistry;
  let imports: ImportGraph;
  let resolutions: ResolutionRegistry;
  let context: CallResolutionContext;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    scopes = new ScopeRegistry();
    references = new ReferenceRegistry();
    imports = new ImportGraph();
    resolutions = new ResolutionRegistry();
    context = { references, scopes, types, definitions, imports, resolutions, ...make_export_chain_context() };
  });

  describe("Empty inputs", () => {
    it("returns empty result for empty file_ids", () => {
      const result = resolve_calls_for_files(new Set(), context);

      expect(result.resolved_calls_by_file.size).toBe(0);
      expect(result.calls_by_caller_scope.size).toBe(0);
      expect(result.indirect_reachability.size).toBe(0);
    });

    it("returns empty calls for file with no references", () => {
      const file_ids = new Set([TEST_FILE]);

      // Set up empty scope structure
      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const result = resolve_calls_for_files(file_ids, context);

      expect(result.resolved_calls_by_file.get(TEST_FILE)).toEqual([]);
    });
  });

  describe("Function call resolution", () => {
    it("resolves function call to symbol", () => {
      // Setup: function greet() {} greet();
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

      // Set up scope structure
      const func_scope_location: Location = {
        ...MOCK_LOCATION,
        start_line: 1,
      };
      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [FUNC_SCOPE_ID],
      });
      scope_map.set(FUNC_SCOPE_ID, {
        id: FUNC_SCOPE_ID,
        type: "function",
        location: func_scope_location,
        parent_id: FILE_SCOPE_ID,
        name: "greet" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Add function call reference
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "greet" as SymbolName,
        location: {
          ...MOCK_LOCATION,
          start_line: 10,
        },
        scope_id: FILE_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [call_ref]);

      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["greet" as SymbolName, func_id]]));
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe("greet" as SymbolName);
      expect(calls[0].call_type).toBe("function");
      expect(calls[0].resolutions).toEqual([
        { symbol_id: func_id, confidence: "certain", reason: { type: "direct" } },
      ]);
    });

    it("returns empty resolutions for unresolved function call", () => {
      // Set up scope structure
      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Add function call reference to undefined function
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "undefined_func" as SymbolName,
        location: MOCK_LOCATION,
        scope_id: FILE_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [call_ref]);

      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      // An unresolved call still emits a CallReference carrying the failure
      // diagnostic, so downstream consumers can report it.
      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].call_type).toBe("function");
      expect(calls[0].resolutions).toEqual([]);
      expect(calls[0].resolution_failure!.reason).toBe("name_not_in_scope");
    });
  });

  describe("Multiple files", () => {
    it("resolves calls across multiple files", () => {
      const file_a = "a.ts" as FilePath;
      const file_b = "b.ts" as FilePath;
      const scope_a = "scope:a.ts:file:0:0" as ScopeId;
      const scope_b = "scope:b.ts:file:0:0" as ScopeId;

      const location_a: Location = { ...MOCK_LOCATION, file_path: file_a };
      const location_b: Location = { ...MOCK_LOCATION, file_path: file_b };

      const func_a = function_symbol("funcA" as SymbolName, location_a);
      const func_b = function_symbol("funcB" as SymbolName, location_b);

      // Set up definitions
      definitions.update_file(file_a, [
        {
          kind: "function",
          symbol_id: func_a,
          name: "funcA" as SymbolName,
          defining_scope_id: scope_a,
          location: location_a,
          signature: { parameters: [] },
          body_scope_id: "scope:a.ts:funcA:1:0" as ScopeId,
          is_exported: false,
        },
      ]);
      definitions.update_file(file_b, [
        {
          kind: "function",
          symbol_id: func_b,
          name: "funcB" as SymbolName,
          defining_scope_id: scope_b,
          location: location_b,
          signature: { parameters: [] },
          body_scope_id: "scope:b.ts:funcB:1:0" as ScopeId,
          is_exported: false,
        },
      ]);

      // Set up scopes
      const scope_map_a = new Map<ScopeId, LexicalScope>();
      scope_map_a.set(scope_a, {
        id: scope_a,
        type: "global",
        location: location_a,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(file_a, scope_map_a);
      const scope_map_b = new Map<ScopeId, LexicalScope>();
      scope_map_b.set(scope_b, {
        id: scope_b,
        type: "global",
        location: location_b,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(file_b, scope_map_b);

      // Add call references
      references.update_file(file_a, [
        {
          kind: "function_call",
          name: "funcA" as SymbolName,
          location: location_a,
          scope_id: scope_a,
        },
      ]);
      references.update_file(file_b, [
        {
          kind: "function_call",
          name: "funcB" as SymbolName,
          location: location_b,
          scope_id: scope_b,
        },
      ]);

      set_test_resolutions(resolutions, scope_a, new Map([["funcA" as SymbolName, func_a]]));
      set_test_resolutions(resolutions, scope_b, new Map([["funcB" as SymbolName, func_b]]));
      const result = resolve_calls_for_files(new Set([file_a, file_b]), context);

      const calls_a = result.resolved_calls_by_file.get(file_a)!;
      const calls_b = result.resolved_calls_by_file.get(file_b)!;
      expect(calls_a.length).toBe(1);
      expect(calls_b.length).toBe(1);
      expect(calls_a[0].resolutions[0].symbol_id).toBe(func_a);
      expect(calls_b[0].resolutions[0].symbol_id).toBe(func_b);
    });
  });

  describe("Caller scope grouping", () => {
    it("groups calls by caller scope", () => {
      const caller_scope = "scope:test.ts:main:1:0" as ScopeId;
      const func_id = function_symbol("helper" as SymbolName, MOCK_LOCATION);

      definitions.update_file(TEST_FILE, [
        {
          kind: "function",
          symbol_id: func_id,
          name: "helper" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          signature: { parameters: [] },
          body_scope_id: FUNC_SCOPE_ID,
          is_exported: false,
        },
      ]);

      // Set up scope structure with caller as function scope
      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [caller_scope],
      });
      scope_map.set(caller_scope, {
        id: caller_scope,
        type: "function",
        location: MOCK_LOCATION,
        parent_id: FILE_SCOPE_ID,
        name: "main" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Call from within the caller scope
      references.update_file(TEST_FILE, [
        {
          kind: "function_call",
          name: "helper" as SymbolName,
          location: MOCK_LOCATION,
          scope_id: caller_scope,
        },
      ]);

      set_test_resolutions(resolutions, caller_scope, new Map([["helper" as SymbolName, func_id]]));
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const caller_calls = result.calls_by_caller_scope.get(caller_scope)!;
      expect(caller_calls.length).toBe(1);
      expect(caller_calls[0].name).toBe("helper" as SymbolName);
      expect(caller_calls[0].resolutions[0].symbol_id).toBe(func_id);
    });
  });

  describe("Method/constructor filtering for function calls", () => {
    // A bare function call may not target a method, so when a method shares a
    // name with an import the import must win.
    const CLASS_SCOPE_ID = "scope:test.ts:class:2:0" as ScopeId;
    const METHOD_BODY_SCOPE_ID = "scope:test.ts:method:3:0" as ScopeId;

    it("skips method when resolving bare function call and finds import", () => {
      // Setup:
      // import { do_work } from "./source";
      // class Wrapper {
      //   do_work() { return do_work(); }  // should resolve to import
      // }

      const source_location: Location = {
        ...MOCK_LOCATION,
        file_path: "source.ts" as FilePath,
      };
      const import_func_id = function_symbol(
        "do_work" as SymbolName,
        source_location
      );
      const method_id = method_symbol("do_work", MOCK_LOCATION);

      // Method definition (in class scope)
      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "do_work" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: MOCK_LOCATION,
        parameters: [],
        body_scope_id: METHOD_BODY_SCOPE_ID,
      };

      // Import is defined as function in source file
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

      // Function call inside method body
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "do_work" as SymbolName,
        location: { ...MOCK_LOCATION, start_line: 10 },
        scope_id: METHOD_BODY_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [call_ref]);

      set_test_resolutions(resolutions, METHOD_BODY_SCOPE_ID, new Map([["do_work" as SymbolName, method_id]]));
      set_test_resolutions(resolutions, CLASS_SCOPE_ID, new Map([["do_work" as SymbolName, method_id]]));
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["do_work" as SymbolName, import_func_id]]));
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].resolutions).toEqual([
        { symbol_id: import_func_id, confidence: "certain", reason: { type: "direct" } },
      ]);
      expect(calls[0].call_type).toBe("function");
    });

    it("allows function definition (not method) even if it shadows", () => {
      // Setup: function do_work() {} nested inside another function
      // Inner function shadows outer, but it's still a function - valid target
      const outer_func_id = function_symbol(
        "do_work" as SymbolName,
        MOCK_LOCATION
      );
      const inner_location: Location = { ...MOCK_LOCATION, start_line: 5 };
      const inner_func_id = function_symbol(
        "do_work" as SymbolName,
        inner_location
      );

      const outer_def: FunctionDefinition = {
        kind: "function",
        symbol_id: outer_func_id,
        name: "do_work" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        signature: { parameters: [] },
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
      };

      const inner_scope_id = "scope:test.ts:inner:5:0" as ScopeId;
      const inner_def: FunctionDefinition = {
        kind: "function",
        symbol_id: inner_func_id,
        name: "do_work" as SymbolName,
        defining_scope_id: FUNC_SCOPE_ID,
        location: inner_location,
        signature: { parameters: [] },
        body_scope_id: inner_scope_id,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [outer_def, inner_def]);

      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "global",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [FUNC_SCOPE_ID],
          },
        ],
        [
          FUNC_SCOPE_ID,
          {
            id: FUNC_SCOPE_ID,
            type: "function",
            location: MOCK_LOCATION,
            parent_id: FILE_SCOPE_ID,
            name: "do_work" as SymbolName,
            child_ids: [inner_scope_id],
          },
        ],
        [
          inner_scope_id,
          {
            id: inner_scope_id,
            type: "function",
            location: inner_location,
            parent_id: FUNC_SCOPE_ID,
            name: "do_work" as SymbolName,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      // Call from inside inner function's scope
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "do_work" as SymbolName,
        location: { ...MOCK_LOCATION, start_line: 8 },
        scope_id: inner_scope_id,
      };
      references.update_file(TEST_FILE, [call_ref]);

      set_test_resolutions(resolutions, inner_scope_id, new Map([["do_work" as SymbolName, inner_func_id]]));
      set_test_resolutions(resolutions, FUNC_SCOPE_ID, new Map([["do_work" as SymbolName, inner_func_id]]));
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["do_work" as SymbolName, outer_func_id]]));
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      // Shadowing is valid function-to-function, so the inner definition wins.
      expect(calls[0].resolutions[0].symbol_id).toBe(inner_func_id);
      expect(calls[0].call_type).toBe("function");
    });

    it("returns no resolution when only method exists (no import/function)", () => {
      // Setup: method exists but no import - call cannot be resolved
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

      definitions.update_file(TEST_FILE, [method_def]);

      const scope_map = new Map<ScopeId, LexicalScope>([
        [
          FILE_SCOPE_ID,
          {
            id: FILE_SCOPE_ID,
            type: "global",
            location: MOCK_LOCATION,
            parent_id: null,
            name: null,
            child_ids: [CLASS_SCOPE_ID],
          },
        ],
        [
          CLASS_SCOPE_ID,
          {
            id: CLASS_SCOPE_ID,
            type: "class",
            location: MOCK_LOCATION,
            parent_id: FILE_SCOPE_ID,
            name: "Wrapper" as SymbolName,
            child_ids: [METHOD_BODY_SCOPE_ID],
          },
        ],
        [
          METHOD_BODY_SCOPE_ID,
          {
            id: METHOD_BODY_SCOPE_ID,
            type: "function",
            location: MOCK_LOCATION,
            parent_id: CLASS_SCOPE_ID,
            name: "do_work" as SymbolName,
            child_ids: [],
          },
        ],
      ]);
      scopes.update_file(TEST_FILE, scope_map);

      // Function call inside method body
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "do_work" as SymbolName,
        location: { ...MOCK_LOCATION, start_line: 10 },
        scope_id: METHOD_BODY_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [call_ref]);

      set_test_resolutions(resolutions, METHOD_BODY_SCOPE_ID, new Map([["do_work" as SymbolName, method_id]]));
      set_test_resolutions(resolutions, CLASS_SCOPE_ID, new Map([["do_work" as SymbolName, method_id]]));
      // FILE_SCOPE_ID has no entry (no import)
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      // A method cannot be the target of a bare function call, so the call is
      // emitted unresolved with a failure diagnostic.
      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].resolutions).toEqual([]);
      expect(calls[0].resolution_failure!.reason).toBe("name_not_in_scope");
    });
  });

  describe("Constructor enrichment pipeline", () => {
    it("includes constructor when function_call resolves to a class", () => {
      // Setup: class MyClass { constructor() {} }
      //        MyClass();  // Python-style call or mis-categorized as function_call
      const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
      const CTOR_SCOPE_ID = "scope:test.ts:MyClass.constructor:2:2" as ScopeId;

      const class_id = class_symbol("MyClass", MOCK_LOCATION);
      const constructor_id =
        "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: CTOR_SCOPE_ID,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def],
      };

      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

      // Scope structure
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
        name: "MyClass" as SymbolName,
        child_ids: [CTOR_SCOPE_ID],
      });
      scope_map.set(CTOR_SCOPE_ID, {
        id: CTOR_SCOPE_ID,
        type: "function",
        location: { ...MOCK_LOCATION, start_line: 2 },
        parent_id: CLASS_SCOPE_ID,
        name: "constructor" as SymbolName,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // function_call reference: MyClass()
      const call_ref: FunctionCallReference = {
        kind: "function_call",
        name: "MyClass" as SymbolName,
        location: { ...MOCK_LOCATION, start_line: 10 },
        scope_id: FILE_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [call_ref]);

      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["MyClass" as SymbolName, class_id]]));
      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      const resolution_ids = calls[0].resolutions.map((r) => r.symbol_id);
      expect(resolution_ids).toEqual([class_id, constructor_id]);
    });
  });

  describe("Method call resolution", () => {
    const RECEIVER_LOCATION: Location = {
      ...MOCK_LOCATION,
      start_column: 0,
      end_column: 3,
    };

    it("resolves method call via receiver type and propagates call_site_syntax", () => {
      const obj_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("Widget" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("render" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map([[obj_id, class_id]]);
      types["resolved_type_members"] = new Map([
        [class_id, new Map([["render" as SymbolName, method_id]])],
      ]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["obj" as SymbolName, obj_id]]));

      const call_ref = create_method_call_reference(
        "render" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID,
        RECEIVER_LOCATION,
        ["obj", "render"] as SymbolName[],
        false,
        undefined,
        { receiver_kind: "identifier" }
      );
      references.update_file(TEST_FILE, [call_ref]);

      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].call_type).toBe("method");
      expect(calls[0].resolutions).toEqual([
        { symbol_id: method_id, confidence: "certain", reason: { type: "direct" } },
      ]);
      expect(calls[0].call_site_syntax).toEqual({ receiver_kind: "identifier" });
    });

    it("binds the assigned variable's type when a namespace constructor resolves to a class", () => {
      const target_location: Location = { ...MOCK_LOCATION, start_line: 10, start_column: 0 };
      const assigned_id = variable_symbol("user", target_location);
      const namespace_id = variable_symbol("models", MOCK_LOCATION);
      const class_id = class_symbol("User" as SymbolName, MOCK_LOCATION);

      const assigned_def: VariableDefinition = {
        kind: "variable",
        symbol_id: assigned_id,
        name: "user" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: target_location,
        is_exported: false,
      };
      const namespace_def: VariableDefinition = {
        kind: "variable",
        symbol_id: namespace_id,
        name: "models" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [],
      };
      definitions.update_file(TEST_FILE, [assigned_def, namespace_def, class_def]);

      types["symbol_types"] = new Map([[namespace_id, namespace_id]]);
      types["resolved_type_members"] = new Map([
        [namespace_id, new Map([["User" as SymbolName, class_id]])],
      ]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["models" as SymbolName, namespace_id]]));

      const call_ref = {
        ...create_method_call_reference(
          "User" as SymbolName,
          { ...MOCK_LOCATION, start_line: 10, start_column: 8 },
          FILE_SCOPE_ID,
          MOCK_LOCATION,
          ["models", "User"] as SymbolName[],
          false
        ),
        potential_construct_target: target_location,
      };
      references.update_file(TEST_FILE, [call_ref]);

      resolve_calls_for_files(new Set([TEST_FILE]), context);

      expect(types.get_symbol_type(assigned_id)).toBe(class_id);
    });
  });

  describe("Constructor call resolution", () => {
    it("resolves constructor_call reference to the constructor symbol", () => {
      const CLASS_SCOPE_ID = "scope:test.ts:Service:1:0" as ScopeId;
      const CTOR_SCOPE_ID = "scope:test.ts:Service.constructor:2:2" as ScopeId;
      const class_id = class_symbol("Service", MOCK_LOCATION);
      const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: CTOR_SCOPE_ID,
      };
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Service" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def],
      };
      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

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
        name: "Service" as SymbolName,
        child_ids: [CTOR_SCOPE_ID],
      });
      scopes.update_file(TEST_FILE, scope_map);

      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map([["Service" as SymbolName, class_id]]));

      const call_ref = create_constructor_call_reference(
        "Service" as SymbolName,
        { ...MOCK_LOCATION, start_line: 10 },
        FILE_SCOPE_ID
      );
      references.update_file(TEST_FILE, [call_ref]);

      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      expect(calls.length).toBe(1);
      expect(calls[0].call_type).toBe("constructor");
      expect(calls[0].resolutions.map((r) => r.symbol_id)).toEqual([constructor_id]);
    });
  });

  describe("Callback invocations", () => {
    it("emits a synthetic invocation edge for a callback passed to a higher-order call", () => {
      const receiver_location: Location = { ...MOCK_LOCATION, start_line: 10, start_column: 0 };
      const callback_id = anonymous_function_symbol({
        ...MOCK_LOCATION,
        start_line: 10,
        start_column: 12,
      });

      const callback_def: FunctionDefinition = {
        kind: "function",
        symbol_id: callback_id,
        name: "<anonymous>" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10, start_column: 12 },
        signature: { parameters: [] },
        body_scope_id: FUNC_SCOPE_ID,
        is_exported: false,
        callback_context: {
          is_callback: true,
          receiver_is_external: false,
          receiver_location,
        },
      };
      definitions.update_file(TEST_FILE, [callback_def]);

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "global",
        location: MOCK_LOCATION,
        parent_id: null,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const receiver_call: FunctionCallReference = {
        kind: "function_call",
        name: "forEach" as SymbolName,
        location: receiver_location,
        scope_id: FILE_SCOPE_ID,
      };
      references.update_file(TEST_FILE, [receiver_call]);

      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const calls = result.resolved_calls_by_file.get(TEST_FILE)!;
      const invocation = calls.find((c) => c.is_callback_invocation === true)!;
      expect(invocation.resolutions).toEqual([
        { symbol_id: callback_id, confidence: "certain", reason: { type: "direct" } },
      ]);
    });

    it("attributes an arrow callback and a function-expression callback alike to the function that passes them", () => {
      // The two forms reach here with different `defining_scope_id`s, exactly as
      // the indexer produces them: an arrow's definition spans its own function
      // scope, so `get_scope_id` lands on the arrow itself, while a `function`
      // expression's definition starts before its scope does, so it lands on the
      // enclosing function. Both are passed at a receiver call inside the
      // enclosing function, and both invocations belong to that function.
      const arrow_caller_scope = "scope:test.ts:dead_with_arrow" as ScopeId;
      const arrow_own_scope = "scope:test.ts:arrow" as ScopeId;
      const expression_caller_scope =
        "scope:test.ts:dead_with_function_expression" as ScopeId;
      const expression_own_scope = "scope:test.ts:function_expression" as ScopeId;

      const arrow_location: Location = {
        file_path: TEST_FILE,
        start_line: 5,
        start_column: 21,
        end_line: 5,
        end_column: 55,
      };
      const arrow_receiver_location: Location = {
        file_path: TEST_FILE,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 56,
      };
      const expression_location: Location = {
        file_path: TEST_FILE,
        start_line: 9,
        start_column: 21,
        end_line: 11,
        end_column: 3,
      };
      const expression_receiver_location: Location = {
        file_path: TEST_FILE,
        start_line: 9,
        start_column: 10,
        end_line: 11,
        end_column: 4,
      };

      const arrow_id = anonymous_function_symbol(arrow_location);
      const expression_id = anonymous_function_symbol(expression_location);

      const arrow_def: FunctionDefinition = {
        kind: "function",
        symbol_id: arrow_id,
        name: "<anonymous>" as SymbolName,
        defining_scope_id: arrow_own_scope,
        location: arrow_location,
        signature: { parameters: [] },
        body_scope_id: arrow_own_scope,
        is_exported: false,
        callback_context: {
          is_callback: true,
          receiver_is_external: null,
          receiver_location: arrow_receiver_location,
        },
      };
      const expression_def: FunctionDefinition = {
        kind: "function",
        symbol_id: expression_id,
        name: "<anonymous>" as SymbolName,
        defining_scope_id: expression_caller_scope,
        location: expression_location,
        signature: { parameters: [] },
        body_scope_id: expression_own_scope,
        is_exported: false,
        callback_context: {
          is_callback: true,
          receiver_is_external: null,
          receiver_location: expression_receiver_location,
        },
      };
      definitions.update_file(TEST_FILE, [arrow_def, expression_def]);

      const span = (
        start_line: number,
        start_column: number,
        end_line: number,
        end_column: number
      ): Location => ({
        file_path: TEST_FILE,
        start_line,
        start_column,
        end_line,
        end_column,
      });

      const scope_map = new Map<ScopeId, LexicalScope>();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "module",
        location: span(1, 1, 13, 0),
        parent_id: null,
        name: null,
        child_ids: [arrow_caller_scope, expression_caller_scope],
      });
      scope_map.set(arrow_caller_scope, {
        id: arrow_caller_scope,
        type: "function",
        location: span(4, 32, 6, 1),
        parent_id: FILE_SCOPE_ID,
        name: "dead_with_arrow" as SymbolName,
        child_ids: [arrow_own_scope],
      });
      // An arrow's scope is its whole node, so it coincides with the definition.
      scope_map.set(arrow_own_scope, {
        id: arrow_own_scope,
        type: "function",
        location: arrow_location,
        parent_id: arrow_caller_scope,
        name: null,
        child_ids: [],
      });
      scope_map.set(expression_caller_scope, {
        id: expression_caller_scope,
        type: "function",
        location: span(8, 46, 12, 1),
        parent_id: FILE_SCOPE_ID,
        name: "dead_with_function_expression" as SymbolName,
        child_ids: [expression_own_scope],
      });
      // A `function` expression's scope starts at its parameter list, after the
      // definition's own start.
      scope_map.set(expression_own_scope, {
        id: expression_own_scope,
        type: "function",
        location: span(9, 30, 11, 3),
        parent_id: expression_caller_scope,
        name: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      references.update_file(TEST_FILE, [
        create_method_call_reference(
          "map" as SymbolName,
          arrow_receiver_location,
          arrow_caller_scope,
          arrow_receiver_location,
          ["values" as SymbolName],
          false
        ),
        create_method_call_reference(
          "map" as SymbolName,
          expression_receiver_location,
          expression_caller_scope,
          expression_receiver_location,
          ["values" as SymbolName],
          false
        ),
      ]);

      const result = resolve_calls_for_files(new Set([TEST_FILE]), context);

      const callbacks_invoked_by = (scope_id: ScopeId): SymbolId[] =>
        (result.calls_by_caller_scope.get(scope_id) ?? [])
          .filter((call) => call.is_callback_invocation === true)
          .flatMap((call) => call.resolutions.map((r) => r.symbol_id));

      expect({
        dead_with_arrow: callbacks_invoked_by(arrow_caller_scope),
        arrow_itself: callbacks_invoked_by(arrow_own_scope),
        dead_with_function_expression: callbacks_invoked_by(
          expression_caller_scope
        ),
        function_expression_itself: callbacks_invoked_by(expression_own_scope),
      }).toEqual({
        dead_with_arrow: [arrow_id],
        arrow_itself: [],
        dead_with_function_expression: [expression_id],
        function_expression_itself: [],
      });
    });

    it("reports the same caller-to-callback edge for both forms in a real call graph", async () => {
      const source = [
        "function helper_from_arrow(value: number): number { return value + 1; }",
        "function helper_from_function_expression(value: number): number { return value + 2; }",
        "",
        "export function dead_with_arrow(values: number[]): number[] {",
        "  return values.map((value) => helper_from_arrow(value));",
        "}",
        "",
        "export function dead_with_function_expression(values: number[]): number[] {",
        "  return values.map(function (value) {",
        "    return helper_from_function_expression(value);",
        "  });",
        "}",
        "",
      ].join("\n");

      const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "callback-forms-"));
      const probe = path.join(temp_dir, "probe.ts") as FilePath;
      fs.writeFileSync(probe, source);

      const project = new Project();
      await project.initialize(temp_dir as FilePath);
      project.update_file(probe, source);

      const call_graph = project.get_call_graph();
      const describe_node = (symbol_id: SymbolId) => {
        const node = call_graph.nodes.get(symbol_id);
        return node ? `${node.name}@${node.location.start_line}` : `MISSING:${symbol_id}`;
      };

      const callback_edges: string[] = [];
      for (const [symbol_id, node] of call_graph.nodes) {
        for (const call of node.enclosed_calls) {
          if (call.is_callback_invocation !== true) continue;
          for (const resolution of call.resolutions) {
            callback_edges.push(
              `${describe_node(symbol_id)} -> ${describe_node(resolution.symbol_id)}`
            );
          }
        }
      }

      fs.rmSync(temp_dir, { recursive: true, force: true });

      expect(callback_edges.sort()).toEqual([
        "dead_with_arrow@4 -> <anonymous>@5",
        "dead_with_function_expression@8 -> <anonymous>@9",
      ]);
    });

    it("reads one batch's callbacks whether the project holds 4 more files or 400", () => {
      const read_counts: number[] = [];

      for (const project_size of [5, 401]) {
        const definitions_of_size = new DefinitionRegistry();
        const scopes_of_size = new ScopeRegistry();
        const references_of_size = new ReferenceRegistry();

        for (let index = 0; index < project_size; index++) {
          install_callback_file(
            index,
            definitions_of_size,
            scopes_of_size,
            references_of_size
          );
        }

        const batch_file = callback_file_id(0);
        const reads = count_anonymous_callables_read(definitions_of_size);

        const result = resolve_calls_for_files(new Set([batch_file]), {
          references: references_of_size,
          scopes: scopes_of_size,
          types,
          definitions: definitions_of_size,
          imports,
          resolutions,
          ...make_export_chain_context(),
        });

        expect(
          result.resolved_calls_by_file
            .get(batch_file)!
            .filter((call) => call.is_callback_invocation === true)
        ).toHaveLength(CALLBACKS_PER_FILE);
        expect(reads.whole_project_scans).toBe(0);
        read_counts.push(reads.callables_read);
      }

      expect(read_counts).toEqual([CALLBACKS_PER_FILE, CALLBACKS_PER_FILE]);
    });
  });
});

/** Anonymous callbacks `install_callback_file` puts in each file it builds. */
const CALLBACKS_PER_FILE = 2;

const callback_file_id = (index: number): FilePath =>
  `callbacks_${index}.ts` as FilePath;

/**
 * One file of `CALLBACKS_PER_FILE` anonymous callbacks, each passed at its own
 * higher-order call, registered across the three registries call resolution
 * reads them from.
 */
function install_callback_file(
  index: number,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  references: ReferenceRegistry
): void {
  const file_id = callback_file_id(index);
  const file_scope_id = `scope:${file_id}:file:0:0` as ScopeId;

  const callbacks: FunctionDefinition[] = [];
  const receiver_calls: FunctionCallReference[] = [];

  for (let callback = 0; callback < CALLBACKS_PER_FILE; callback++) {
    const line = 10 + callback;
    const receiver_location: Location = {
      file_path: file_id,
      start_line: line,
      start_column: 0,
      end_line: line,
      end_column: 40,
    };
    const callback_location: Location = {
      ...receiver_location,
      start_column: 12,
    };

    callbacks.push({
      kind: "function",
      symbol_id: anonymous_function_symbol(callback_location),
      name: "<anonymous>" as SymbolName,
      defining_scope_id: file_scope_id,
      location: callback_location,
      signature: { parameters: [] },
      body_scope_id: `scope:${file_id}:callback:${line}` as ScopeId,
      is_exported: false,
      callback_context: {
        is_callback: true,
        receiver_is_external: false,
        receiver_location,
      },
    });

    receiver_calls.push({
      kind: "function_call",
      name: "forEach" as SymbolName,
      location: receiver_location,
      scope_id: file_scope_id,
    });
  }

  definitions.update_file(file_id, callbacks);

  const scope_map = new Map<ScopeId, LexicalScope>();
  scope_map.set(file_scope_id, {
    id: file_scope_id,
    type: "global",
    location: {
      file_path: file_id,
      start_line: 0,
      start_column: 0,
      end_line: 100,
      end_column: 0,
    },
    parent_id: null,
    name: null,
    child_ids: [],
  });
  scopes.update_file(file_id, scope_map);

  references.update_file(file_id, receiver_calls);
}

/**
 * What one resolve pass reads out of the definition registry to find its
 * callbacks: the callables handed back per file, and any request for the whole
 * project's callable set — the scan whose cost is the corpus rather than the
 * batch.
 */
function count_anonymous_callables_read(definitions: DefinitionRegistry): {
  readonly callables_read: number;
  readonly whole_project_scans: number;
} {
  const counts = { callables_read: 0, whole_project_scans: 0 };

  const per_file = definitions.get_anonymous_callables_in_file.bind(definitions);
  definitions.get_anonymous_callables_in_file = (
    file_id: FilePath
  ): readonly FunctionDefinition[] => {
    const found = per_file(file_id);
    counts.callables_read += found.length;
    return found;
  };

  const whole_project = definitions.get_callable_definitions.bind(definitions);
  definitions.get_callable_definitions = (): CallableDefinition[] => {
    counts.whole_project_scans++;
    return whole_project();
  };

  return counts;
}
