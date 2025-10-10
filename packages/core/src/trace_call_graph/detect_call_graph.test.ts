/**
 * Comprehensive tests for call graph detection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  location_key,
  function_symbol,
  type CallReference,
  type FunctionDefinition,
  type FilePath,
  type Location,
  type SymbolId,
  type ScopeId,
  type SymbolName,
  type SymbolReference,
  type ResolvedSymbols,
} from "@ariadnejs/types";
import { detect_call_graph } from "./detect_call_graph";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import { DefinitionRegistry } from "../project/definition_registry";
import { ResolutionCache } from "../project/resolution_cache";

// Helper to create minimal SemanticIndex for testing
function make_test_index(
  file_path: FilePath,
  references: SymbolReference[] = [],
  scopes: Map<ScopeId, any> = new Map(),
): SemanticIndex {
  return {
    file_path,
    language: "typescript",
    root_scope_id: "module:0:0" as ScopeId,
    scopes,
    scope_to_definitions: new Map(),
    functions: new Map(),
    classes: new Map(),
    variables: new Map(),
    interfaces: new Map(),
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
    imported_symbols: new Map(),
    references,
    exported_symbols: new Map(),
    type_bindings: new Map(),
    type_members: new Map(),
    type_alias_metadata: new Map(),
  };
}

// Test helper for building registry-based test setup
function setup_call_graph_test(
  file_path: FilePath,
  definitions: FunctionDefinition[],
  references: SymbolReference[],
  custom_scopes?: Map<ScopeId, any>,
  resolved_calls?: Map<string, SymbolId>
) {
  // Build default scopes from function definitions if not provided
  let scopes = custom_scopes;
  if (!scopes) {
    scopes = new Map();

    // Add module scope
    const moduleScope = "module:0:0" as ScopeId;
    scopes.set(moduleScope, {
      id: moduleScope,
      parent_id: null,
      name: null,
      type: "module",
      location: create_location(file_path, 0),
      child_ids: definitions.map(def => def.body_scope_id!).filter(id => id),
    });

    // Add function body scopes
    for (const def of definitions) {
      if (def.body_scope_id) {
        scopes.set(def.body_scope_id, {
          id: def.body_scope_id,
          parent_id: moduleScope,
          name: def.name,
          type: "function",
          location: def.location,
          child_ids: [],
        });
      }
    }
  }

  // Create semantic index
  const semantic_index = make_test_index(file_path, references, scopes);
  const semantic_indexes = new Map([[file_path, semantic_index]]);

  // Create definition registry
  const definition_registry = new DefinitionRegistry();
  definition_registry.update_file(file_path, definitions);

  // Create resolution cache
  const resolution_cache = new ResolutionCache();

  // Add resolved calls if provided
  if (resolved_calls) {
    for (const [location_key, symbol_id] of resolved_calls) {
      resolution_cache.set(location_key as any, symbol_id, file_path);
    }
  }

  return {
    semantic_indexes,
    definitions: definition_registry,
    resolutions: resolution_cache,
    detect_call_graph: () => detect_call_graph(semantic_indexes, definition_registry, resolution_cache)
  };
}

// Helper to create location key for resolution cache
function create_location_key(location: Location): string {
  return `${location.file_path}:${location.start_line}:${location.start_column}`;
}

const create_location = (
  file: string,
  start_line: number,
  column: number = 0,
): Location => ({
  file_path: file as FilePath,
  start_line: start_line,
  start_column: column,
  end_line: start_line,
  end_column: column + 10,
});

describe("detect_call_graph", () => {

  const create_symbol_id = (name: string, qualifier?: string): SymbolId =>
    (qualifier ? `${qualifier}.${name}` : name) as SymbolId;

  const create_definition = (
    id: SymbolId,
    name: string,
    location: Location,
    body_scope_id?: ScopeId,
  ): FunctionDefinition => ({
    symbol_id: id,
    name: name as SymbolName,
    kind: "function",
    defining_scope_id: "global" as ScopeId,
    location,
    is_exported: false,
    signature: {
      parameters: [],
    },
    body_scope_id: body_scope_id || `scope:${id}:body` as ScopeId,
  });

  const create_call_reference = (
    name: string,
    location: Location,
    scope_id?: ScopeId,
  ): SymbolReference => ({
    name: name as SymbolName,
    location,
    scope_id: scope_id || ("global" as ScopeId),
    type: "call",
    call_type: "function",
    construct_target: undefined,
    enclosing_function_scope_id: scope_id,
    receiver: undefined,
  });

  describe("basic functionality", () => {
    it("should detect call graph with single function", () => {
      const file_path = "test.ts" as FilePath;
      const funcId = create_symbol_id("testFunc");
      const funcLocation = create_location(file_path, 1);
      const funcDef = create_definition(funcId, "testFunc", funcLocation);

      // Create semantic index with no references
      const semantic_indexes = new Map([
        [file_path, make_test_index(file_path, [])],
      ]);

      // Create definition registry with the function
      const definitions = new DefinitionRegistry();
      definitions.update_file(file_path, [funcDef]);

      // Create empty resolution cache
      const resolutions = new ResolutionCache();

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get(funcId)).toEqual({
        symbol_id: funcId,
        name: "testFunc",
        enclosed_calls: [],
        location: funcLocation,
        definition: funcDef,
      });
      expect(graph.entry_points).toEqual([funcId]);
    });

    it("should detect call graph with multiple functions and references", () => {
      const file_path = "test.ts" as FilePath;
      const func1Id = create_symbol_id("func1");
      const func2Id = create_symbol_id("func2");
      const func1Location = create_location(file_path, 1);
      const func2Location = create_location(file_path, 5);

      const moduleScope = "module:0:0" as ScopeId;
      const func1BodyScope = `scope:${func1Id}:body` as ScopeId;
      const func2BodyScope = `scope:${func2Id}:body` as ScopeId;

      const func1Def = create_definition(func1Id, "func1", func1Location, func1BodyScope);
      const func2Def = create_definition(func2Id, "func2", func2Location, func2BodyScope);

      const call1Location = create_location(file_path, 2);
      const call1 = create_call_reference("func2", call1Location, func1BodyScope);

      // Create scopes map with proper hierarchy
      const scopes = new Map([
        [moduleScope, {
          id: moduleScope,
          parent_id: null,
          name: null,
          type: "module",
          location: create_location(file_path, 0),
          child_ids: [func1BodyScope, func2BodyScope],
        }],
        [func1BodyScope, {
          id: func1BodyScope,
          parent_id: moduleScope,
          name: "func1" as SymbolName,
          type: "function",
          location: func1Location,
          child_ids: [],
        }],
        [func2BodyScope, {
          id: func2BodyScope,
          parent_id: moduleScope,
          name: "func2" as SymbolName,
          type: "function",
          location: func2Location,
          child_ids: [],
        }],
      ]);

      // Create semantic index with the call reference and scopes
      const semantic_indexes = new Map([
        [file_path, make_test_index(file_path, [call1], scopes)],
      ]);

      // Create definition registry with both functions
      const definitions = new DefinitionRegistry();
      definitions.update_file(file_path, [func1Def, func2Def]);

      // Create resolution cache with the call resolution
      const resolutions = new ResolutionCache();
      // Simulate the resolution of call1 to func2
      resolutions.set(`${call1Location.file_path}:${call1Location.start_line}:${call1Location.start_column}` as any, func2Id, file_path);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(2);

      const func1Node = graph.nodes.get(func1Id);
      expect(func1Node?.enclosed_calls).toHaveLength(1);
      expect(func1Node?.enclosed_calls[0]).toMatchObject({
        name: "func2",
        location: call1Location,
        call_type: "function",
      });

      const func2Node = graph.nodes.get(func2Id);
      expect(func2Node?.enclosed_calls).toEqual([]);

      // func1 is entry point (never called), func2 is not (called by func1)
      expect(graph.entry_points).toEqual([func1Id]);
    });

    it("should detect entry points correctly - functions never called", () => {
      const file_path = "test.ts" as FilePath;
      const entryFunc1Id = create_symbol_id("entryPoint1");
      const entryFunc2Id = create_symbol_id("entryPoint2");
      const calledFuncId = create_symbol_id("calledFunc");

      const entryFunc1Location = create_location(file_path, 1);
      const entryFunc2Location = create_location(file_path, 5);
      const calledFuncLocation = create_location(file_path, 10);

      const entryFunc1BodyScope = `scope:${entryFunc1Id}:body` as ScopeId;
      const entryFunc2BodyScope = `scope:${entryFunc2Id}:body` as ScopeId;
      const calledFuncBodyScope = `scope:${calledFuncId}:body` as ScopeId;

      const entryFunc1Def = create_definition(entryFunc1Id, "entryPoint1", entryFunc1Location, entryFunc1BodyScope);
      const entryFunc2Def = create_definition(entryFunc2Id, "entryPoint2", entryFunc2Location, entryFunc2BodyScope);
      const calledFuncDef = create_definition(calledFuncId, "calledFunc", calledFuncLocation, calledFuncBodyScope);

      // entryPoint1 calls calledFunc
      const callLocation = create_location(file_path, 2);
      const call = create_call_reference("calledFunc", callLocation, entryFunc1BodyScope);

      const moduleScope = "module:0:0" as ScopeId;
      const scopes = new Map([
        [moduleScope, {
          id: moduleScope,
          parent_id: null,
          name: null,
          type: "module",
          location: create_location(file_path, 0),
          child_ids: [entryFunc1BodyScope],
        }],
        [entryFunc1BodyScope, {
          id: entryFunc1BodyScope,
          parent_id: moduleScope,
          name: "entryPoint1" as SymbolName,
          type: "function",
          location: entryFunc1Location,
          child_ids: [],
        }],
      ]);

      const semantic_indexes = new Map([
        [file_path, make_test_index(file_path, [call], scopes)],
      ]);

      const definitions = new DefinitionRegistry();
      definitions.update_file(file_path, [entryFunc1Def, entryFunc2Def, calledFuncDef]);

      const resolutions = new ResolutionCache();
      // Simulate the resolution of call to calledFunc
      resolutions.set(`${callLocation.file_path}:${callLocation.start_line}:${callLocation.start_column}` as any, calledFuncId, file_path);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(3);

      // Entry points should be functions that are never called
      // entryPoint1 and entryPoint2 are never called, so they're entry points
      // calledFunc is called by entryPoint1, so it's not an entry point
      expect(graph.entry_points.sort()).toEqual([entryFunc1Id, entryFunc2Id].sort());
    });

    it("should handle recursive functions correctly in entry point detection", () => {
      const file_path = "test.ts" as FilePath;
      const recursiveFuncId = create_symbol_id("recursiveFunc");
      const entryFuncId = create_symbol_id("entryFunc");

      const recursiveFuncLocation = create_location(file_path, 1);
      const entryFuncLocation = create_location(file_path, 10);

      const recursiveFuncBodyScope = `scope:${recursiveFuncId}:body` as ScopeId;
      const entryFuncBodyScope = `scope:${entryFuncId}:body` as ScopeId;

      const recursiveFuncDef = create_definition(recursiveFuncId, "recursiveFunc", recursiveFuncLocation, recursiveFuncBodyScope);
      const entryFuncDef = create_definition(entryFuncId, "entryFunc", entryFuncLocation, entryFuncBodyScope);

      // recursiveFunc calls itself
      const selfCallLocation = create_location(file_path, 2);
      const selfCall = create_call_reference("recursiveFunc", selfCallLocation, recursiveFuncBodyScope);

      const moduleScope = "module:0:0" as ScopeId;
      const scopes = new Map([
        [moduleScope, {
          id: moduleScope,
          parent_id: null,
          name: null,
          type: "module",
          location: create_location(file_path, 0),
          child_ids: [recursiveFuncBodyScope, entryFuncBodyScope],
        }],
        [recursiveFuncBodyScope, {
          id: recursiveFuncBodyScope,
          parent_id: moduleScope,
          name: "recursiveFunc" as SymbolName,
          type: "function",
          location: recursiveFuncLocation,
          child_ids: [],
        }],
        [entryFuncBodyScope, {
          id: entryFuncBodyScope,
          parent_id: moduleScope,
          name: "entryFunc" as SymbolName,
          type: "function",
          location: entryFuncLocation,
          child_ids: [],
        }],
      ]);

      const semantic_indexes = new Map([
        [file_path, make_test_index(file_path, [selfCall], scopes)],
      ]);

      const definitions = new DefinitionRegistry();
      definitions.update_file(file_path, [recursiveFuncDef, entryFuncDef]);

      const resolutions = new ResolutionCache();
      // Simulate the resolution of self call
      resolutions.set(`${selfCallLocation.file_path}:${selfCallLocation.start_line}:${selfCallLocation.start_column}` as any, recursiveFuncId, file_path);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(2);

      // entryFunc is never called, so it's an entry point
      // recursiveFunc calls itself, so it's referenced and NOT an entry point
      expect(graph.entry_points).toEqual([entryFuncId]);
    });

    it("should handle empty codebase correctly", () => {
      const semantic_indexes = new Map();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionCache();

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(0);
      expect(graph.entry_points).toEqual([]);
    });

    it("should handle complex call chains", () => {
      const mainId = create_symbol_id("main");
      const processId = create_symbol_id("process");
      const utilityId = create_symbol_id("utility");
      const helperId = create_symbol_id("helper");

      const mainLocation = create_location("app.ts", 1);
      const processLocation = create_location("app.ts", 10);
      const utilityLocation = create_location("utils.ts", 1);
      const helperLocation = create_location("utils.ts", 20);

      const mainBodyScope = `scope:${mainId}:body` as ScopeId;
      const processBodyScope = `scope:${processId}:body` as ScopeId;
      const utilityBodyScope = `scope:${utilityId}:body` as ScopeId;
      const helperBodyScope = `scope:${helperId}:body` as ScopeId;

      // main calls process and utility
      const call1Location = create_location("app.ts", 2);
      const call2Location = create_location("app.ts", 3);
      const call1 = create_call_reference("process", call1Location, mainBodyScope);
      const call2 = create_call_reference("utility", call2Location, mainBodyScope);

      // process calls utility and helper
      const call3Location = create_location("app.ts", 11);
      const call4Location = create_location("app.ts", 12);
      const call3 = create_call_reference("utility", call3Location, processBodyScope);
      const call4 = create_call_reference("helper", call4Location, processBodyScope);

      // utility calls helper
      const call5Location = create_location("utils.ts", 2);
      const call5 = create_call_reference("helper", call5Location, utilityBodyScope);

      // Create multi-file test setup
      const app_definitions = [
        create_definition(mainId, "main", mainLocation, mainBodyScope),
        create_definition(processId, "process", processLocation, processBodyScope),
      ];
      const utils_definitions = [
        create_definition(utilityId, "utility", utilityLocation, utilityBodyScope),
        create_definition(helperId, "helper", helperLocation, helperBodyScope),
      ];

      const app_references = [call1, call2, call3, call4];
      const utils_references = [call5];

      // Create semantic indexes for both files
      const app_semantic_index = make_test_index("app.ts" as FilePath, app_references);
      const utils_semantic_index = make_test_index("utils.ts" as FilePath, utils_references);
      const semantic_indexes = new Map([
        ["app.ts" as FilePath, app_semantic_index],
        ["utils.ts" as FilePath, utils_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("app.ts" as FilePath, app_definitions);
      definitions.update_file("utils.ts" as FilePath, utils_definitions);

      // Create resolution cache with all call resolutions
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(call1Location) as any, processId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call2Location) as any, utilityId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call3Location) as any, utilityId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call4Location) as any, helperId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call5Location) as any, helperId, "utils.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(4);

      // Verify main function node
      expect(graph.nodes.get(mainId)?.enclosed_calls).toEqual([call1, call2]);

      // Verify process function node
      expect(graph.nodes.get(processId)?.enclosed_calls).toEqual([
        call3,
        call4,
      ]);

      // Verify utility function node
      expect(graph.nodes.get(utilityId)?.enclosed_calls).toEqual([call5]);

      // Verify helper function node
      expect(graph.nodes.get(helperId)?.enclosed_calls).toEqual([]);

      // Only main should be an entry point
      expect(graph.entry_points).toEqual([mainId]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty resolved symbols", () => {
      const semantic_indexes = new Map();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionCache();

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(0);
      expect(graph.entry_points).toEqual([]);
    });

    it("should handle functions with no calls", () => {
      const func1Id = create_symbol_id("emptyFunc1");
      const func2Id = create_symbol_id("emptyFunc2");
      const func1Location = create_location("test.ts", 1);
      const func2Location = create_location("test.ts", 10);

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(func1Id, "emptyFunc1", func1Location),
        create_definition(func2Id, "emptyFunc2", func2Location),
      ];

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [], // no references
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get(func1Id)?.enclosed_calls).toEqual([]);
      expect(graph.nodes.get(func2Id)?.enclosed_calls).toEqual([]);
      expect(graph.entry_points).toEqual([func1Id, func2Id]);
    });

    it("should handle unresolved references gracefully", () => {
      const funcId = create_symbol_id("testFunc");
      const funcLocation = create_location("test.ts", 1);
      const callLocation = create_location("test.ts", 2);

      const funcBodyScope = `scope:${funcId}:body` as ScopeId;
      const call = create_call_reference("unknownFunc", callLocation, funcBodyScope);

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(funcId, "testFunc", funcLocation, funcBodyScope),
      ];

      // Don't provide any resolved calls - call remains unresolved
      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call], // include the call reference
        // No resolved_calls map - call remains unresolved
      );

      // Should not throw, but should handle unresolved references
      const graph = detect();

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get(funcId)?.enclosed_calls).toEqual([]);
      expect(graph.entry_points).toEqual([funcId]);
    });

    it("should handle multiple entry points", () => {
      const mainId = create_symbol_id("main");
      const testId = create_symbol_id("testRunner");
      const utilId = create_symbol_id("utility");

      const mainLocation = create_location("app.ts", 1);
      const testLocation = create_location("test.ts", 1);
      const utilLocation = create_location("utils.ts", 1);

      const mainBodyScope = `scope:${mainId}:body` as ScopeId;
      const testBodyScope = `scope:${testId}:body` as ScopeId;
      const utilBodyScope = `scope:${utilId}:body` as ScopeId;

      // main calls utility
      const call1Location = create_location("app.ts", 2);
      const call1 = create_call_reference("utility", call1Location, mainBodyScope);

      // testRunner calls utility
      const call2Location = create_location("test.ts", 2);
      const call2 = create_call_reference("utility", call2Location, testBodyScope);

      // Create multi-file setup
      const app_definitions = [
        create_definition(mainId, "main", mainLocation, mainBodyScope),
      ];
      const test_definitions = [
        create_definition(testId, "testRunner", testLocation, testBodyScope),
      ];
      const utils_definitions = [
        create_definition(utilId, "utility", utilLocation, utilBodyScope),
      ];

      // Create semantic indexes
      const app_semantic_index = make_test_index("app.ts" as FilePath, [call1]);
      const test_semantic_index = make_test_index("test.ts" as FilePath, [call2]);
      const utils_semantic_index = make_test_index("utils.ts" as FilePath, []);
      const semantic_indexes = new Map([
        ["app.ts" as FilePath, app_semantic_index],
        ["test.ts" as FilePath, test_semantic_index],
        ["utils.ts" as FilePath, utils_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("app.ts" as FilePath, app_definitions);
      definitions.update_file("test.ts" as FilePath, test_definitions);
      definitions.update_file("utils.ts" as FilePath, utils_definitions);

      // Create resolution cache
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(call1Location) as any, utilId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call2Location) as any, utilId, "test.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      // main and testRunner are entry points (never called)
      // utility is called by both, so it's not an entry point
      expect([...graph.entry_points].sort()).toEqual([mainId, testId].sort());
    });

    it("should handle recursive function calls", () => {
      const recursiveId = create_symbol_id("recursiveFunc");
      const recursiveLocation = create_location("test.ts", 1);

      const recursiveBodyScope = `scope:${recursiveId}:body` as ScopeId;

      // recursiveFunc calls itself
      const callLocation = create_location("test.ts", 2);
      const call = create_call_reference(
        "recursiveFunc",
        callLocation,
        recursiveBodyScope,
      );

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(recursiveId, "recursiveFunc", recursiveLocation, recursiveBodyScope),
      ];
      const resolved_calls = new Map([
        [create_location_key(callLocation), recursiveId],
      ]);

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call],
        undefined, // no custom scopes
        resolved_calls
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(1);
      const node = graph.nodes.get(recursiveId);
      expect(node?.enclosed_calls).toEqual([call]);

      // A recursive function that calls itself is still tracked in resolutions,
      // so it won't be detected as an entry point by the current implementation
      expect(graph.entry_points).toEqual([]);
    });

    it("should identify recursive function as entry point when not called externally", () => {
      const mainId = create_symbol_id("main");
      const recursiveId = create_symbol_id("recursiveFunc");
      const mainLocation = create_location("main.ts", 1);
      const recursiveLocation = create_location("recursive.ts", 1);

      const mainBodyScope = `scope:${mainId}:body` as ScopeId;
      const recursiveBodyScope = `scope:${recursiveId}:body` as ScopeId;

      // main exists but doesn't call recursiveFunc
      // recursiveFunc only calls itself
      const callLocation = create_location("recursive.ts", 2);
      const recursiveCall = create_call_reference(
        "recursiveFunc",
        callLocation,
        recursiveBodyScope,
      );

      // Create multi-file setup
      const main_definitions = [
        create_definition(mainId, "main", mainLocation, mainBodyScope),
      ];
      const recursive_definitions = [
        create_definition(recursiveId, "recursiveFunc", recursiveLocation, recursiveBodyScope),
      ];

      // Create semantic indexes
      const main_semantic_index = make_test_index("main.ts" as FilePath, []);
      const recursive_semantic_index = make_test_index("recursive.ts" as FilePath, [recursiveCall]);
      const semantic_indexes = new Map([
        ["main.ts" as FilePath, main_semantic_index],
        ["recursive.ts" as FilePath, recursive_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("main.ts" as FilePath, main_definitions);
      definitions.update_file("recursive.ts" as FilePath, recursive_definitions);

      // Create resolution cache
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(callLocation) as any, recursiveId, "recursive.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(2);

      // main has no calls
      expect(graph.nodes.get(mainId)?.enclosed_calls).toEqual([]);

      // recursiveFunc calls itself
      expect(graph.nodes.get(recursiveId)?.enclosed_calls).toEqual([
        recursiveCall,
      ]);

      // main is an entry point (never called)
      // recursiveFunc is NOT an entry point (it's called, even if only by itself)
      expect(graph.entry_points).toEqual([mainId]);
    });

    it("should handle mutual recursion", () => {
      const func1Id = create_symbol_id("mutualFunc1");
      const func2Id = create_symbol_id("mutualFunc2");
      const func1Location = create_location("test.ts", 1);
      const func2Location = create_location("test.ts", 5);

      const func1BodyScope = `scope:${func1Id}:body` as ScopeId;
      const func2BodyScope = `scope:${func2Id}:body` as ScopeId;

      // func1 calls func2
      const call1Location = create_location("test.ts", 2);
      const call1 = create_call_reference(
        "mutualFunc2",
        call1Location,
        func1BodyScope,
      );

      // func2 calls func1
      const call2Location = create_location("test.ts", 6);
      const call2 = create_call_reference(
        "mutualFunc1",
        call2Location,
        func2BodyScope,
      );

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(func1Id, "mutualFunc1", func1Location, func1BodyScope),
        create_definition(func2Id, "mutualFunc2", func2Location, func2BodyScope),
      ];
      const resolved_calls = new Map([
        [create_location_key(call1Location), func2Id],
        [create_location_key(call2Location), func1Id],
      ]);

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call1, call2],
        undefined, // no custom scopes
        resolved_calls
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get(func1Id)?.enclosed_calls).toEqual([call1]);
      expect(graph.nodes.get(func2Id)?.enclosed_calls).toEqual([call2]);

      // Neither function is an entry point since they call each other
      expect(graph.entry_points).toEqual([]);
    });
  });

  describe("cross-file scenarios", () => {
    it("should handle functions across multiple files", () => {
      const exportedId = create_symbol_id("exportedFunc");
      const importerId = create_symbol_id("importerFunc");
      const utilId = create_symbol_id("utilFunc");

      const exportedLocation = create_location("lib.ts", 1);
      const importerLocation = create_location("app.ts", 5);
      const utilLocation = create_location("utils.ts", 1);

      const exportedBodyScope = `scope:${exportedId}:body` as ScopeId;
      const importerBodyScope = `scope:${importerId}:body` as ScopeId;
      const utilBodyScope = `scope:${utilId}:body` as ScopeId;

      // importerFunc calls exportedFunc and utilFunc
      const call1Location = create_location("app.ts", 6);
      const call2Location = create_location("app.ts", 7);
      const call1 = create_call_reference(
        "exportedFunc",
        call1Location,
        importerBodyScope,
      );
      const call2 = create_call_reference(
        "utilFunc",
        call2Location,
        importerBodyScope,
      );

      // exportedFunc calls utilFunc
      const call3Location = create_location("lib.ts", 2);
      const call3 = create_call_reference(
        "utilFunc",
        call3Location,
        exportedBodyScope,
      );

      // Create multi-file definitions
      const lib_definitions = [
        create_definition(exportedId, "exportedFunc", exportedLocation, exportedBodyScope),
      ];
      const app_definitions = [
        create_definition(importerId, "importerFunc", importerLocation, importerBodyScope),
      ];
      const utils_definitions = [
        create_definition(utilId, "utilFunc", utilLocation, utilBodyScope),
      ];

      // Create semantic indexes
      const lib_semantic_index = make_test_index("lib.ts" as FilePath, [call3]);
      const app_semantic_index = make_test_index("app.ts" as FilePath, [call1, call2]);
      const utils_semantic_index = make_test_index("utils.ts" as FilePath, []);
      const semantic_indexes = new Map([
        ["lib.ts" as FilePath, lib_semantic_index],
        ["app.ts" as FilePath, app_semantic_index],
        ["utils.ts" as FilePath, utils_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("lib.ts" as FilePath, lib_definitions);
      definitions.update_file("app.ts" as FilePath, app_definitions);
      definitions.update_file("utils.ts" as FilePath, utils_definitions);

      // Create resolution cache
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(call1Location) as any, exportedId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call2Location) as any, utilId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call3Location) as any, utilId, "lib.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(3);

      // Verify enclosed calls for each function
      expect(graph.nodes.get(importerId)?.enclosed_calls).toEqual([
        call1,
        call2,
      ]);
      expect(graph.nodes.get(exportedId)?.enclosed_calls).toEqual([call3]);
      expect(graph.nodes.get(utilId)?.enclosed_calls).toEqual([]);

      // Only importerFunc is an entry point
      expect(graph.entry_points).toEqual([importerId]);
    });

    it("should correctly identify multiple enclosed calls in same function", () => {
      const funcId = create_symbol_id("mainFunc");
      const targetId = create_symbol_id("targetFunc");
      const funcLocation = create_location("main.ts", 1);
      const targetLocation = create_location("target.ts", 1);

      const funcBodyScope = `scope:${funcId}:body` as ScopeId;
      const targetBodyScope = `scope:${targetId}:body` as ScopeId;

      // mainFunc calls targetFunc multiple times
      const call1Location = create_location("main.ts", 5);
      const call2Location = create_location("main.ts", 10);
      const call3Location = create_location("main.ts", 15);
      const call1 = create_call_reference("targetFunc", call1Location, funcBodyScope);
      const call2 = create_call_reference("targetFunc", call2Location, funcBodyScope);
      const call3 = create_call_reference("targetFunc", call3Location, funcBodyScope);

      // Create multi-file definitions
      const main_definitions = [
        create_definition(funcId, "mainFunc", funcLocation, funcBodyScope),
      ];
      const target_definitions = [
        create_definition(targetId, "targetFunc", targetLocation, targetBodyScope),
      ];

      // Create semantic indexes
      const main_semantic_index = make_test_index("main.ts" as FilePath, [call1, call2, call3]);
      const target_semantic_index = make_test_index("target.ts" as FilePath, []);
      const semantic_indexes = new Map([
        ["main.ts" as FilePath, main_semantic_index],
        ["target.ts" as FilePath, target_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("main.ts" as FilePath, main_definitions);
      definitions.update_file("target.ts" as FilePath, target_definitions);

      // Create resolution cache
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(call1Location) as any, targetId, "main.ts" as FilePath);
      resolutions.set(create_location_key(call2Location) as any, targetId, "main.ts" as FilePath);
      resolutions.set(create_location_key(call3Location) as any, targetId, "main.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      const mainNode = graph.nodes.get(funcId);
      expect(mainNode?.enclosed_calls).toHaveLength(3);
      expect(mainNode?.enclosed_calls).toEqual([call1, call2, call3]);
    });
  });

  describe("qualified names and namespaces", () => {
    it("should handle qualified function names", () => {
      const classMethodId = create_symbol_id("MyClass.method");
      const namespaceFunc = create_symbol_id("MyNamespace.func");
      const regularFunc = create_symbol_id("regularFunc");

      const methodLocation = create_location("class.ts", 5);
      const namespaceLocation = create_location("namespace.ts", 10);
      const regularLocation = create_location("app.ts", 1);

      const classMethodBodyScope = `scope:${classMethodId}:body` as ScopeId;
      const namespaceFuncBodyScope = `scope:${namespaceFunc}:body` as ScopeId;
      const regularFuncBodyScope = `scope:${regularFunc}:body` as ScopeId;

      // regularFunc calls the class method and namespace function
      const call1Location = create_location("app.ts", 2);
      const call2Location = create_location("app.ts", 3);
      const call1 = create_call_reference("method", call1Location, regularFuncBodyScope);
      const call2 = create_call_reference("func", call2Location, regularFuncBodyScope);

      // Create multi-file definitions
      const class_definitions = [
        create_definition(classMethodId, "method", methodLocation, classMethodBodyScope),
      ];
      const namespace_definitions = [
        create_definition(namespaceFunc, "func", namespaceLocation, namespaceFuncBodyScope),
      ];
      const app_definitions = [
        create_definition(regularFunc, "regularFunc", regularLocation, regularFuncBodyScope),
      ];

      // Create semantic indexes
      const class_semantic_index = make_test_index("class.ts" as FilePath, []);
      const namespace_semantic_index = make_test_index("namespace.ts" as FilePath, []);
      const app_semantic_index = make_test_index("app.ts" as FilePath, [call1, call2]);
      const semantic_indexes = new Map([
        ["class.ts" as FilePath, class_semantic_index],
        ["namespace.ts" as FilePath, namespace_semantic_index],
        ["app.ts" as FilePath, app_semantic_index],
      ]);

      // Create definition registry
      const definitions = new DefinitionRegistry();
      definitions.update_file("class.ts" as FilePath, class_definitions);
      definitions.update_file("namespace.ts" as FilePath, namespace_definitions);
      definitions.update_file("app.ts" as FilePath, app_definitions);

      // Create resolution cache
      const resolutions = new ResolutionCache();
      resolutions.set(create_location_key(call1Location) as any, classMethodId, "app.ts" as FilePath);
      resolutions.set(create_location_key(call2Location) as any, namespaceFunc, "app.ts" as FilePath);

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(3);
      expect(graph.nodes.get(regularFunc)?.enclosed_calls).toEqual([
        call1,
        call2,
      ]);
      expect(graph.entry_points).toEqual([regularFunc]);
    });
  });

  describe("registry architecture edge cases", () => {
    it("should handle functions with nested scopes correctly", () => {
      const outerId = create_symbol_id("outerFunc");
      const innerId = create_symbol_id("innerFunc");
      const targetId = create_symbol_id("targetFunc");

      const outerLocation = create_location("test.ts", 1);
      const innerLocation = create_location("test.ts", 3);
      const targetLocation = create_location("test.ts", 10);

      const outerBodyScope = `scope:${outerId}:body` as ScopeId;
      const innerBodyScope = `scope:${innerId}:body` as ScopeId;
      const targetBodyScope = `scope:${targetId}:body` as ScopeId;

      // innerFunc is nested inside outerFunc and calls targetFunc
      const callLocation = create_location("test.ts", 4);
      const call = create_call_reference("targetFunc", callLocation, innerBodyScope);

      // Create scope hierarchy with nested function
      const scopes = new Map([
        ["module:0:0" as ScopeId, {
          id: "module:0:0" as ScopeId,
          parent_id: null,
          name: null,
          type: "module",
          location: create_location("test.ts", 0),
          child_ids: [outerBodyScope, targetBodyScope],
        }],
        [outerBodyScope, {
          id: outerBodyScope,
          parent_id: "module:0:0" as ScopeId,
          name: "outerFunc" as SymbolName,
          type: "function",
          location: outerLocation,
          child_ids: [innerBodyScope],
        }],
        [innerBodyScope, {
          id: innerBodyScope,
          parent_id: outerBodyScope,
          name: "innerFunc" as SymbolName,
          type: "function",
          location: innerLocation,
          child_ids: [],
        }],
        [targetBodyScope, {
          id: targetBodyScope,
          parent_id: "module:0:0" as ScopeId,
          name: "targetFunc" as SymbolName,
          type: "function",
          location: targetLocation,
          child_ids: [],
        }],
      ]);

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(outerId, "outerFunc", outerLocation, outerBodyScope),
        create_definition(innerId, "innerFunc", innerLocation, innerBodyScope),
        create_definition(targetId, "targetFunc", targetLocation, targetBodyScope),
      ];
      const resolved_calls = new Map([
        [create_location_key(callLocation), targetId],
      ]);

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call],
        scopes,
        resolved_calls
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(3);

      // outerFunc should have no enclosed calls (call is in nested function)
      expect(graph.nodes.get(outerId)?.enclosed_calls).toEqual([]);

      // innerFunc should have the call to targetFunc
      expect(graph.nodes.get(innerId)?.enclosed_calls).toEqual([call]);

      // targetFunc should have no calls
      expect(graph.nodes.get(targetId)?.enclosed_calls).toEqual([]);

      // outerFunc is entry point (never called)
      expect(graph.entry_points).toEqual([outerId]);
    });

    it("should handle files with only non-function definitions", () => {
      const file_path = "constants.ts" as FilePath;
      const semantic_indexes = new Map([
        [file_path, make_test_index(file_path, [])], // No references, no functions
      ]);
      const definitions = new DefinitionRegistry();
      // No function definitions
      const resolutions = new ResolutionCache();

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(0);
      expect(graph.entry_points).toEqual([]);
    });

    it("should handle call references that don't resolve to function definitions", () => {
      const funcId = create_symbol_id("testFunc");
      const varId = create_symbol_id("someVariable");

      const funcLocation = create_location("test.ts", 1);
      const varLocation = create_location("test.ts", 5);

      const funcBodyScope = `scope:${funcId}:body` as ScopeId;

      // Function calls something that resolves to a variable, not a function
      const callLocation = create_location("test.ts", 2);
      const call = create_call_reference("someVariable", callLocation, funcBodyScope);

      const file_path = "test.ts" as FilePath;

      // Only define the function, not the variable (since we only track function definitions)
      const definitions = [
        create_definition(funcId, "testFunc", funcLocation, funcBodyScope),
      ];

      // The call resolves to a variable (which won't be in function definitions)
      const resolved_calls = new Map([
        [create_location_key(callLocation), varId],
      ]);

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call],
        undefined,
        resolved_calls
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(1);

      // Function should have no enclosed calls since the call doesn't resolve to a function
      expect(graph.nodes.get(funcId)?.enclosed_calls).toEqual([]);

      // Function is entry point
      expect(graph.entry_points).toEqual([funcId]);
    });

    it("should handle empty semantic indexes map", () => {
      const semantic_indexes = new Map();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionCache();

      const graph = detect_call_graph(semantic_indexes, definitions, resolutions);

      expect(graph.nodes.size).toBe(0);
      expect(graph.entry_points).toEqual([]);
    });

    it("should correctly handle body_scope_id for enclosed call detection", () => {
      const funcId = create_symbol_id("parentFunc");
      const targetId = create_symbol_id("targetFunc");

      const funcLocation = create_location("test.ts", 1);
      const targetLocation = create_location("test.ts", 10);

      const funcBodyScope = `scope:${funcId}:body` as ScopeId;
      const targetBodyScope = `scope:${targetId}:body` as ScopeId;

      // Call from within the function body
      const callLocation = create_location("test.ts", 3);
      const call = create_call_reference("targetFunc", callLocation, funcBodyScope);

      const file_path = "test.ts" as FilePath;
      const definitions = [
        create_definition(funcId, "parentFunc", funcLocation, funcBodyScope),
        create_definition(targetId, "targetFunc", targetLocation, targetBodyScope),
      ];
      const resolved_calls = new Map([
        [create_location_key(callLocation), targetId],
      ]);

      const { detect_call_graph: detect } = setup_call_graph_test(
        file_path,
        definitions,
        [call],
        undefined,
        resolved_calls
      );

      const graph = detect();

      expect(graph.nodes.size).toBe(2);

      // parentFunc should have the enclosed call
      const parentNode = graph.nodes.get(funcId);
      expect(parentNode?.enclosed_calls).toEqual([call]);
      expect(parentNode?.definition.body_scope_id).toBe(funcBodyScope);

      // targetFunc should have no calls
      expect(graph.nodes.get(targetId)?.enclosed_calls).toEqual([]);

      // parentFunc is entry point
      expect(graph.entry_points).toEqual([funcId]);
    });
  });
});
