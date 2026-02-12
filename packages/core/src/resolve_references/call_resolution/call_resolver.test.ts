/**
 * Unit Tests for Call Resolver (Phase 2)
 *
 * Tests the pure functions for resolving call references to their target symbols.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  resolve_calls_for_files,
  type CallResolutionContext,
  type NameResolver,
} from "./call_resolver";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ScopeRegistry } from "../registries/scope";
import { ReferenceRegistry } from "../registries/reference";
import { ImportGraph } from "../../project/import_graph";
import { function_symbol, method_symbol, class_symbol } from "@ariadnejs/types";
import type {
  FilePath,
  ScopeId,
  SymbolId,
  SymbolName,
  Location,
  FunctionDefinition,
  MethodDefinition,
  ClassDefinition,
  ConstructorDefinition,
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
  let context: CallResolutionContext;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    scopes = new ScopeRegistry();
    references = new ReferenceRegistry();
    imports = new ImportGraph();
    context = { references, scopes, types, definitions, imports };
  });

  describe("Empty inputs", () => {
    it("should return empty result for empty file_ids", () => {
      const name_resolver: NameResolver = () => null;
      const result = resolve_calls_for_files(new Set(), context, name_resolver);

      expect(result.resolved_calls_by_file.size).toBe(0);
      expect(result.calls_by_caller_scope.size).toBe(0);
      expect(result.indirect_reachability.size).toBe(0);
    });

    it("should return empty calls for file with no references", () => {
      const name_resolver: NameResolver = () => null;
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

      const result = resolve_calls_for_files(file_ids, context, name_resolver);

      expect(result.resolved_calls_by_file.get(TEST_FILE)).toEqual([]);
    });
  });

  describe("Function call resolution", () => {
    it("should resolve function call to symbol", () => {
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

      // Name resolver that resolves greet in FILE_SCOPE_ID
      const name_resolver: NameResolver = (scope_id, name) => {
        if (scope_id === FILE_SCOPE_ID && name === "greet") {
          return func_id;
        }
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toBeDefined();
      expect(calls!.length).toBe(1);
      expect(calls![0].name).toBe("greet");
      expect(calls![0].call_type).toBe("function");
      expect(calls![0].resolutions.length).toBe(1);
      expect(calls![0].resolutions[0].symbol_id).toBe(func_id);
    });

    it("should return empty resolutions for unresolved function call", () => {
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

      // Name resolver that can't resolve anything
      const name_resolver: NameResolver = () => null;

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      // No resolved calls since resolution failed
      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toEqual([]);
    });
  });

  describe("Multiple files", () => {
    it("should resolve calls across multiple files", () => {
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

      const name_resolver: NameResolver = (scope_id, name) => {
        if (scope_id === scope_a && name === "funcA") return func_a;
        if (scope_id === scope_b && name === "funcB") return func_b;
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([file_a, file_b]),
        context,
        name_resolver
      );

      expect(result.resolved_calls_by_file.get(file_a)!.length).toBe(1);
      expect(result.resolved_calls_by_file.get(file_b)!.length).toBe(1);
      expect(result.resolved_calls_by_file.get(file_a)![0].name).toBe("funcA");
      expect(result.resolved_calls_by_file.get(file_b)![0].name).toBe("funcB");
    });
  });

  describe("Caller scope grouping", () => {
    it("should group calls by caller scope", () => {
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

      const name_resolver: NameResolver = (scope_id, name) => {
        if (name === "helper") return func_id;
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      // Check calls are grouped by caller scope
      const caller_calls = result.calls_by_caller_scope.get(caller_scope);
      expect(caller_calls).toBeDefined();
      expect(caller_calls!.length).toBe(1);
      expect(caller_calls![0].name).toBe("helper");
    });
  });

  describe("Method/constructor filtering for function calls", () => {
    // Test the self-shadowing bug fix: when a method has the same name as an import,
    // bare function calls should resolve to the import, not the method

    const CLASS_SCOPE_ID = "scope:test.ts:class:2:0" as ScopeId;
    const METHOD_BODY_SCOPE_ID = "scope:test.ts:method:3:0" as ScopeId;

    it("should skip method when resolving bare function call and find import", () => {
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

      // Name resolver that simulates lexical scope resolution:
      // - METHOD_BODY_SCOPE resolves to method (wrong for function_call)
      // - FILE_SCOPE_ID resolves to imported function (correct)
      const name_resolver: NameResolver = (scope_id, name) => {
        if (name === "do_work") {
          if (scope_id === METHOD_BODY_SCOPE_ID) return method_id;
          if (scope_id === CLASS_SCOPE_ID) return method_id;
          if (scope_id === FILE_SCOPE_ID) return import_func_id;
        }
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toBeDefined();
      expect(calls!.length).toBe(1);
      // Should resolve to the imported function, NOT the method
      expect(calls![0].resolutions[0].symbol_id).toBe(import_func_id);
      expect(calls![0].call_type).toBe("function");
    });

    it("should allow function definition (not method) even if it shadows", () => {
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

      const name_resolver: NameResolver = (scope_id, name) => {
        if (name === "do_work") {
          if (scope_id === inner_scope_id) return inner_func_id;
          if (scope_id === FUNC_SCOPE_ID) return inner_func_id;
          if (scope_id === FILE_SCOPE_ID) return outer_func_id;
        }
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toBeDefined();
      expect(calls!.length).toBe(1);
      // Should resolve to inner function (shadowing is valid for function-to-function)
      expect(calls![0].resolutions[0].symbol_id).toBe(inner_func_id);
    });

    it("should return no resolution when only method exists (no import/function)", () => {
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

      // Name resolver: resolves to method in all scopes, no import exists
      const name_resolver: NameResolver = (scope_id, name) => {
        if (name === "do_work") {
          if (scope_id === METHOD_BODY_SCOPE_ID) return method_id;
          if (scope_id === CLASS_SCOPE_ID) return method_id;
          // FILE_SCOPE_ID returns null (no import)
        }
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      // Should have no resolved calls - method can't be target of bare function call
      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toEqual([]);
    });
  });

  describe("Constructor enrichment pipeline", () => {
    it("should include constructor when function_call resolves to a class", () => {
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

      // Name resolver returns class symbol for "MyClass"
      const name_resolver: NameResolver = (scope_id, name) => {
        if (name === "MyClass") return class_id;
        return null;
      };

      const result = resolve_calls_for_files(
        new Set([TEST_FILE]),
        context,
        name_resolver
      );

      const calls = result.resolved_calls_by_file.get(TEST_FILE);
      expect(calls).toBeDefined();
      expect(calls!.length).toBe(1);

      // Should have both class and constructor in resolutions
      const resolution_ids = calls![0].resolutions.map((r) => r.symbol_id);
      expect(resolution_ids).toContain(class_id);
      expect(resolution_ids).toContain(constructor_id);
    });
  });
});
