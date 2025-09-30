/**
 * Comprehensive tests for call graph detection
 */

// @ts-nocheck - Legacy test using deprecated APIs, needs migration to builder pattern

import { describe, it, expect, beforeEach } from "vitest";
import {
  location_key,
  type CallReference,
  type Definition,
  type FilePath,
  type Location,
  type ResolvedSymbols,
  type SymbolId,
  type ScopeId,
  type SymbolName,
} from "@ariadnejs/types";
import { detect_call_graph } from "./detect_call_graph";

describe("detect_call_graph", () => {
  const create_location = (
    file: string,
    line: number,
    column: number = 0
  ): Location => ({
    file_path: file as FilePath,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  });

  const create_symbol_id = (name: string, qualifier?: string): SymbolId =>
    (qualifier ? `${qualifier}.${name}` : name) as SymbolId;

  const create_definition = (
    id: SymbolId,
    name: string,
    location: Location
  ): Definition => ({
    id,
    name: name as SymbolName,
    kind: "function",
    scope_id: "global" as ScopeId,
    location,
  });

  const create_call_reference = (
    name: string,
    location: Location,
    enclosing_scope?: ScopeId
  ): CallReference => ({
    name: name as SymbolName,
    location,
    enclosing_scope: enclosing_scope || ("global" as ScopeId),
  });

  describe("basic functionality", () => {
    it("should detect call graph with single function", () => {
      const funcId = create_symbol_id("testFunc");
      const funcLocation = create_location("test.ts", 1);
      const resolved: ResolvedSymbols = {
        definitions: new Map([[funcId, create_definition(funcId, "testFunc", funcLocation)]]),
        references: [],
        resolved_references: new Map(),
        references_to_symbol: new Map(),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get(funcId)).toEqual({
        symbol_id: funcId,
        name: "testFunc",
        enclosed_calls: [],
        location: funcLocation,
      });
      expect(graph.entry_points).toEqual([funcId]);
    });

    it("should detect call graph with multiple functions and references", () => {
      const func1Id = create_symbol_id("func1");
      const func2Id = create_symbol_id("func2");
      const func1Location = create_location("test.ts", 1);
      const func2Location = create_location("test.ts", 5);

      const call1Location = create_location("test.ts", 2);
      const call1 = create_call_reference("func2", call1Location, func1Id);
      const call1Key = location_key(call1Location);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [func1Id, create_definition(func1Id, "func1", func1Location)],
          [func2Id, create_definition(func2Id, "func2", func2Location)],
        ]),
        references: [call1],
        resolved_references: new Map([[call1Key, func1Id]]),
        references_to_symbol: new Map([[func2Id, [call1]]]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(2);

      const func1Node = graph.nodes.get(func1Id);
      expect(func1Node).toEqual({
        symbol_id: func1Id,
        name: "func1",
        enclosed_calls: [call1],
        location: func1Location,
      });

      const func2Node = graph.nodes.get(func2Id);
      expect(func2Node).toEqual({
        symbol_id: func2Id,
        name: "func2",
        enclosed_calls: [],
        location: func2Location,
      });

      // func1 is an entry point (not called by anyone)
      // func2 is called by func1, so it's not an entry point
      expect(graph.entry_points).toEqual([func1Id]);
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

      // main calls process and utility
      const call1Location = create_location("app.ts", 2);
      const call2Location = create_location("app.ts", 3);
      const call1 = create_call_reference("process", call1Location, mainId);
      const call2 = create_call_reference("utility", call2Location, mainId);

      // process calls utility and helper
      const call3Location = create_location("app.ts", 11);
      const call4Location = create_location("app.ts", 12);
      const call3 = create_call_reference("utility", call3Location, processId);
      const call4 = create_call_reference("helper", call4Location, processId);

      // utility calls helper
      const call5Location = create_location("utils.ts", 2);
      const call5 = create_call_reference("helper", call5Location, utilityId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [mainId, create_definition(mainId, "main", mainLocation)],
          [processId, create_definition(processId, "process", processLocation)],
          [utilityId, create_definition(utilityId, "utility", utilityLocation)],
          [helperId, create_definition(helperId, "helper", helperLocation)],
        ]),
        references: [call1, call2, call3, call4, call5],
        resolved_references: new Map([
          [location_key(call1Location), mainId],
          [location_key(call2Location), mainId],
          [location_key(call3Location), processId],
          [location_key(call4Location), processId],
          [location_key(call5Location), utilityId],
        ]),
        references_to_symbol: new Map([
          [processId, [call1]],
          [utilityId, [call2, call3]],
          [helperId, [call4, call5]],
        ]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(4);

      // Verify main function node
      expect(graph.nodes.get(mainId)?.enclosed_calls).toEqual([call1, call2]);

      // Verify process function node
      expect(graph.nodes.get(processId)?.enclosed_calls).toEqual([call3, call4]);

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
      const resolved: ResolvedSymbols = {
        definitions: new Map(),
        references: [],
        resolved_references: new Map(),
        references_to_symbol: new Map(),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(0);
      expect(graph.entry_points).toEqual([]);
    });

    it("should handle functions with no calls", () => {
      const func1Id = create_symbol_id("emptyFunc1");
      const func2Id = create_symbol_id("emptyFunc2");
      const func1Location = create_location("test.ts", 1);
      const func2Location = create_location("test.ts", 10);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [func1Id, create_definition(func1Id, "emptyFunc1", func1Location)],
          [func2Id, create_definition(func2Id, "emptyFunc2", func2Location)],
        ]),
        references: [],
        resolved_references: new Map(),
        references_to_symbol: new Map(),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get(func1Id)?.enclosed_calls).toEqual([]);
      expect(graph.nodes.get(func2Id)?.enclosed_calls).toEqual([]);
      expect(graph.entry_points).toEqual([func1Id, func2Id]);
    });

    it("should throw error for missing resolved reference", () => {
      const funcId = create_symbol_id("testFunc");
      const funcLocation = create_location("test.ts", 1);
      const callLocation = create_location("test.ts", 2);
      const call = create_call_reference("unknownFunc", callLocation, funcId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([[funcId, create_definition(funcId, "testFunc", funcLocation)]]),
        references: [call],
        resolved_references: new Map(), // Missing the resolution for call
        references_to_symbol: new Map(),
      };

      expect(() => detect_call_graph(resolved)).toThrow(
        `Resolved symbol not found for reference ${location_key(callLocation)}`
      );
    });

    it("should handle multiple entry points", () => {
      const mainId = create_symbol_id("main");
      const testId = create_symbol_id("testRunner");
      const utilId = create_symbol_id("utility");

      const mainLocation = create_location("app.ts", 1);
      const testLocation = create_location("test.ts", 1);
      const utilLocation = create_location("utils.ts", 1);

      // main calls utility
      const call1Location = create_location("app.ts", 2);
      const call1 = create_call_reference("utility", call1Location, mainId);

      // testRunner calls utility
      const call2Location = create_location("test.ts", 2);
      const call2 = create_call_reference("utility", call2Location, testId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [mainId, create_definition(mainId, "main", mainLocation)],
          [testId, create_definition(testId, "testRunner", testLocation)],
          [utilId, create_definition(utilId, "utility", utilLocation)],
        ]),
        references: [call1, call2],
        resolved_references: new Map([
          [location_key(call1Location), mainId],
          [location_key(call2Location), testId],
        ]),
        references_to_symbol: new Map([[utilId, [call1, call2]]]),
      };

      const graph = detect_call_graph(resolved);

      // main and testRunner are entry points (never called)
      // utility is called by both, so it's not an entry point
      expect(graph.entry_points.sort()).toEqual([mainId, testId].sort());
    });

    it("should handle recursive function calls", () => {
      const recursiveId = create_symbol_id("recursiveFunc");
      const recursiveLocation = create_location("test.ts", 1);

      // recursiveFunc calls itself
      const callLocation = create_location("test.ts", 2);
      const call = create_call_reference("recursiveFunc", callLocation, recursiveId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [recursiveId, create_definition(recursiveId, "recursiveFunc", recursiveLocation)],
        ]),
        references: [call],
        resolved_references: new Map([[location_key(callLocation), recursiveId]]),
        references_to_symbol: new Map([[recursiveId, [call]]]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(1);
      const node = graph.nodes.get(recursiveId);
      expect(node?.enclosed_calls).toEqual([call]);

      // A recursive function that calls itself is still tracked in references_to_symbol,
      // so it won't be detected as an entry point by the current implementation
      expect(graph.entry_points).toEqual([]);
    });

    it("should identify recursive function as entry point when not called externally", () => {
      const mainId = create_symbol_id("main");
      const recursiveId = create_symbol_id("recursiveFunc");
      const mainLocation = create_location("main.ts", 1);
      const recursiveLocation = create_location("recursive.ts", 1);

      // main exists but doesn't call recursiveFunc
      // recursiveFunc only calls itself
      const callLocation = create_location("recursive.ts", 2);
      const recursiveCall = create_call_reference("recursiveFunc", callLocation, recursiveId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [mainId, create_definition(mainId, "main", mainLocation)],
          [recursiveId, create_definition(recursiveId, "recursiveFunc", recursiveLocation)],
        ]),
        references: [recursiveCall],
        resolved_references: new Map([[location_key(callLocation), recursiveId]]),
        references_to_symbol: new Map([[recursiveId, [recursiveCall]]]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(2);

      // main has no calls
      expect(graph.nodes.get(mainId)?.enclosed_calls).toEqual([]);

      // recursiveFunc calls itself
      expect(graph.nodes.get(recursiveId)?.enclosed_calls).toEqual([recursiveCall]);

      // main is an entry point (never called)
      // recursiveFunc is NOT an entry point (it's called, even if only by itself)
      expect(graph.entry_points).toEqual([mainId]);
    });

    it("should handle mutual recursion", () => {
      const func1Id = create_symbol_id("mutualFunc1");
      const func2Id = create_symbol_id("mutualFunc2");
      const func1Location = create_location("test.ts", 1);
      const func2Location = create_location("test.ts", 5);

      // func1 calls func2
      const call1Location = create_location("test.ts", 2);
      const call1 = create_call_reference("mutualFunc2", call1Location, func1Id);

      // func2 calls func1
      const call2Location = create_location("test.ts", 6);
      const call2 = create_call_reference("mutualFunc1", call2Location, func2Id);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [func1Id, create_definition(func1Id, "mutualFunc1", func1Location)],
          [func2Id, create_definition(func2Id, "mutualFunc2", func2Location)],
        ]),
        references: [call1, call2],
        resolved_references: new Map([
          [location_key(call1Location), func1Id],
          [location_key(call2Location), func2Id],
        ]),
        references_to_symbol: new Map([
          [func2Id, [call1]],
          [func1Id, [call2]],
        ]),
      };

      const graph = detect_call_graph(resolved);

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

      // importerFunc calls exportedFunc and utilFunc
      const call1Location = create_location("app.ts", 6);
      const call2Location = create_location("app.ts", 7);
      const call1 = create_call_reference("exportedFunc", call1Location, importerId);
      const call2 = create_call_reference("utilFunc", call2Location, importerId);

      // exportedFunc calls utilFunc
      const call3Location = create_location("lib.ts", 2);
      const call3 = create_call_reference("utilFunc", call3Location, exportedId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [exportedId, create_definition(exportedId, "exportedFunc", exportedLocation)],
          [importerId, create_definition(importerId, "importerFunc", importerLocation)],
          [utilId, create_definition(utilId, "utilFunc", utilLocation)],
        ]),
        references: [call1, call2, call3],
        resolved_references: new Map([
          [location_key(call1Location), importerId],
          [location_key(call2Location), importerId],
          [location_key(call3Location), exportedId],
        ]),
        references_to_symbol: new Map([
          [exportedId, [call1]],
          [utilId, [call2, call3]],
        ]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(3);

      // Verify enclosed calls for each function
      expect(graph.nodes.get(importerId)?.enclosed_calls).toEqual([call1, call2]);
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

      // mainFunc calls targetFunc multiple times
      const call1Location = create_location("main.ts", 5);
      const call2Location = create_location("main.ts", 10);
      const call3Location = create_location("main.ts", 15);
      const call1 = create_call_reference("targetFunc", call1Location, funcId);
      const call2 = create_call_reference("targetFunc", call2Location, funcId);
      const call3 = create_call_reference("targetFunc", call3Location, funcId);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [funcId, create_definition(funcId, "mainFunc", funcLocation)],
          [targetId, create_definition(targetId, "targetFunc", targetLocation)],
        ]),
        references: [call1, call2, call3],
        resolved_references: new Map([
          [location_key(call1Location), funcId],
          [location_key(call2Location), funcId],
          [location_key(call3Location), funcId],
        ]),
        references_to_symbol: new Map([[targetId, [call1, call2, call3]]]),
      };

      const graph = detect_call_graph(resolved);

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

      // regularFunc calls the class method and namespace function
      const call1Location = create_location("app.ts", 2);
      const call2Location = create_location("app.ts", 3);
      const call1 = create_call_reference("method", call1Location, regularFunc);
      const call2 = create_call_reference("func", call2Location, regularFunc);

      const resolved: ResolvedSymbols = {
        definitions: new Map([
          [classMethodId, create_definition(classMethodId, "method", methodLocation)],
          [namespaceFunc, create_definition(namespaceFunc, "func", namespaceLocation)],
          [regularFunc, create_definition(regularFunc, "regularFunc", regularLocation)],
        ]),
        references: [call1, call2],
        resolved_references: new Map([
          [location_key(call1Location), regularFunc],
          [location_key(call2Location), regularFunc],
        ]),
        references_to_symbol: new Map([
          [classMethodId, [call1]],
          [namespaceFunc, [call2]],
        ]),
      };

      const graph = detect_call_graph(resolved);

      expect(graph.nodes.size).toBe(3);
      expect(graph.nodes.get(regularFunc)?.enclosed_calls).toEqual([call1, call2]);
      expect(graph.entry_points).toEqual([regularFunc]);
    });
  });
});