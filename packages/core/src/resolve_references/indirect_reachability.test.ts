/**
 * Unit Tests for detect_indirect_reachability
 *
 * Tests detection of indirectly reachable functions through:
 * - Function collection reads (existing behavior)
 * - Function-as-value references (new behavior)
 */

import { describe, it, expect } from "vitest";
import { detect_indirect_reachability } from "./indirect_reachability";
import { function_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  FilePath,
  Location,
  FunctionCollection,
  AnyDefinition,
  ScopeId,
  FunctionDefinition,
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

function make_variable_def(name: string, location: Location): VariableDefinition {
  return {
    kind: "variable",
    symbol_id: variable_symbol(name as SymbolName, location),
    name: name as SymbolName,
    defining_scope_id: SCOPE_FILE,
    location,
    is_exported: false,
  };
}

function mock_definition_registry(
  defs: Map<SymbolId, AnyDefinition>,
  collections: Map<SymbolId, FunctionCollection> = new Map()
): DefinitionRegistry {
  return {
    get: (symbol_id: SymbolId) => defs.get(symbol_id),
    get_function_collection: (symbol_id: SymbolId) => collections.get(symbol_id),
  } as unknown as DefinitionRegistry;
}

describe("detect_indirect_reachability", () => {
  describe("function reference detection", () => {
    it("should mark function definition read as a value as function_reference", () => {
      const fn_def = make_function_def("doubler", MOCK_LOCATION);
      const defs = new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]);
      const registry = mock_definition_registry(defs);

      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "variable_reference",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "doubler" as SymbolName,
              location: READ_LOCATION,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) =>
        name === ("doubler" as SymbolName) ? fn_def.symbol_id : null;

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(1);
      expect(result.has(fn_def.symbol_id)).toBe(true);
      const entry = result.get(fn_def.symbol_id)!;
      expect(entry.function_id).toBe(fn_def.symbol_id);
      expect(entry.reason.type).toBe("function_reference");
      expect(entry.reason).toEqual({
        type: "function_reference",
        read_location: READ_LOCATION,
      });
    });

    it("should NOT mark variable (non-function) read as indirectly reachable", () => {
      const var_def = make_variable_def("counter", MOCK_LOCATION);
      const defs = new Map<SymbolId, AnyDefinition>([[var_def.symbol_id, var_def]]);
      const registry = mock_definition_registry(defs);

      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "variable_reference",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "counter" as SymbolName,
              location: READ_LOCATION,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) =>
        name === ("counter" as SymbolName) ? var_def.symbol_id : null;

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(0);
    });

    it("should NOT mark non-read access types", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const defs = new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]);
      const registry = mock_definition_registry(defs);

      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "variable_reference",
              access_type: "write",
              scope_id: SCOPE_FILE,
              name: "handler" as SymbolName,
              location: READ_LOCATION,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) =>
        name === ("handler" as SymbolName) ? fn_def.symbol_id : null;

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(0);
    });

    it("should mark multiple function references in same file", () => {
      const fn_a = make_function_def("doubler", MOCK_LOCATION);
      const loc_b: Location = { ...MOCK_LOCATION, start_line: 3, end_line: 3 };
      const fn_b = make_function_def("tripler", loc_b);
      const defs = new Map<SymbolId, AnyDefinition>([
        [fn_a.symbol_id, fn_a],
        [fn_b.symbol_id, fn_b],
      ]);
      const registry = mock_definition_registry(defs);

      const read_loc_b: Location = { ...READ_LOCATION, start_line: 6, end_line: 6 };
      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "variable_reference",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "doubler" as SymbolName,
              location: READ_LOCATION,
            },
            {
              kind: "variable_reference",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "tripler" as SymbolName,
              location: read_loc_b,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) => {
        if (name === ("doubler" as SymbolName)) return fn_a.symbol_id;
        if (name === ("tripler" as SymbolName)) return fn_b.symbol_id;
        return null;
      };

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(2);
      expect(result.has(fn_a.symbol_id)).toBe(true);
      expect(result.has(fn_b.symbol_id)).toBe(true);
    });

    it("should skip non-variable_reference kinds", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const defs = new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]);
      const registry = mock_definition_registry(defs);

      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "function_call",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "handler" as SymbolName,
              location: READ_LOCATION,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) =>
        name === ("handler" as SymbolName) ? fn_def.symbol_id : null;

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(0);
    });
  });

  describe("collection read detection (existing behavior)", () => {
    it("should mark functions in a collection as collection_read", () => {
      const fn_def = make_function_def("handler", MOCK_LOCATION);
      const collection_loc: Location = { ...MOCK_LOCATION, start_line: 10, end_line: 10 };
      const collection_id = variable_symbol("HANDLERS" as SymbolName, collection_loc);
      const collection: FunctionCollection = {
        collection_id: collection_id,
        collection_type: "Array",
        location: collection_loc,
        stored_functions: [fn_def.symbol_id],
      };

      const defs = new Map<SymbolId, AnyDefinition>([[fn_def.symbol_id, fn_def]]);
      const collections = new Map<SymbolId, FunctionCollection>([[collection_id, collection]]);
      const registry = mock_definition_registry(defs, collections);

      const file_references = new Map([
        [
          TEST_FILE,
          [
            {
              kind: "variable_reference",
              access_type: "read",
              scope_id: SCOPE_FILE,
              name: "HANDLERS" as SymbolName,
              location: READ_LOCATION,
            },
          ],
        ],
      ]);

      const resolve = (_scope_id: string, name: SymbolName) =>
        name === ("HANDLERS" as SymbolName) ? collection_id : null;

      const result = detect_indirect_reachability(
        file_references as Map<FilePath, readonly { kind: string; access_type?: string; scope_id: string; name: SymbolName; location: Location }[]>,
        registry,
        resolve
      );

      expect(result.size).toBe(1);
      expect(result.has(fn_def.symbol_id)).toBe(true);
      const entry = result.get(fn_def.symbol_id)!;
      expect(entry.reason.type).toBe("collection_read");
      expect(entry.reason).toEqual({
        type: "collection_read",
        collection_id,
        read_location: READ_LOCATION,
      });
    });
  });
});
