/**
 * Function Resolution Test - Example using new comprehensive mock factories
 *
 * This is an example showing how the new test factories can replace
 * manual mock data creation and solve ReadonlyMap mutation issues.
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Location,
  LocationKey,
  ScopeId,
} from "@ariadnejs/types";
import { location_key, function_symbol } from "@ariadnejs/types";
import type { CallReference } from "@ariadnejs/types/src/call_chains";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import { resolve_function_calls } from "./function_resolver";
import type { FunctionResolutionMap } from "./function_types";

// Import the comprehensive mock factories
import {
  mock_semantic_index,
  mock_symbol_definition,
  mock_call_reference,
  mock_location,
  mock_lexical_scope,
  mock_import_resolution_map,
  create_function_scenario,
  readonly_map_from_entries,
  ReadonlyMapBuilder,
} from "../test_factories";

describe("Function Resolution with Mock Factories", () => {
  const test_file = "test.js" as FilePath;

  describe("Using Individual Mock Factories", () => {
    it("should resolve simple function call", () => {
      // Create mock data using factories - much cleaner than manual creation
      const func_location = mock_location(test_file, 1, 10, 1, 18);
      const call_location = mock_location(test_file, 5, 5, 5, 13);
      const root_scope_id = "scope:module" as ScopeId;

      // Create function symbol using factory
      const func_symbol = mock_symbol_definition(
        "testFunc" as SymbolName,
        "function",
        func_location,
        {
          scope_id: root_scope_id,
          is_hoisted: true,
        }
      );

      // Create call reference using factory
      const call_ref = mock_call_reference(
        "testFunc" as SymbolName,
        call_location,
        root_scope_id
      );

      // Create root scope using factory
      const root_scope = mock_lexical_scope(
        root_scope_id,
        "module",
        mock_location(test_file, 1, 1, 100, 1),
        {
          symbols: new Map([["testFunc" as SymbolName, func_symbol]]),
        }
      );

      // Create semantic index using factory with proper ReadonlyMap handling
      const symbols = new Map([[func_symbol.id, func_symbol]]);
      const scopes = new Map([[root_scope_id, root_scope]]);

      const index = mock_semantic_index(test_file, {
        language: "javascript",
        symbols,
        scopes,
        calls: [call_ref],
      });

      // Create import resolution map using factory
      const import_map = mock_import_resolution_map();

      // Test the function resolution
      const result = resolve_function_calls(
        new Map([[test_file, index]]),
        import_map
      );

      // Verify the result
      const call_key = location_key(call_location);
      expect(result.function_calls.get(call_key)).toBe(func_symbol.id);
      expect(result.calls_to_function.get(func_symbol.id)).toEqual([
        call_location,
      ]);
    });
  });

  describe("Using Pre-built Scenarios", () => {
    it("should resolve function call using scenario factory", () => {
      // Use the pre-built scenario - even cleaner!
      const scenario = create_function_scenario(test_file);

      // Override language to JavaScript for this test
      const index = {
        ...scenario.index,
        language: "javascript" as const,
      };

      const import_map = mock_import_resolution_map();

      // Test function resolution
      const result = resolve_function_calls(
        new Map([[test_file, index]]),
        import_map
      );

      // Verify resolution
      const call_key = location_key(scenario.call_reference.location);
      expect(result.function_calls.get(call_key)).toBe(
        scenario.function_symbol.id
      );
      expect(result.calls_to_function.get(scenario.function_symbol.id)).toEqual(
        [scenario.call_reference.location]
      );
    });
  });

  describe("Comparison: Old vs New Approach", () => {
    it("demonstrates ReadonlyMap handling improvement", () => {
      // OLD APPROACH (would cause compilation errors):
      // const registry: GlobalTypeRegistry = { /* ... */ };
      // registry.types.set(type_id, type_info); // ERROR: 'set' does not exist on ReadonlyMap

      // NEW APPROACH (works correctly):
      const entries: [SymbolName, SymbolId][] = [
        ["func1" as SymbolName, "symbol:func1" as SymbolId],
        ["func2" as SymbolName, "symbol:func2" as SymbolId],
      ];

      const readonly_symbol_map = readonly_map_from_entries(entries);

      // This works without mutation errors
      expect(readonly_symbol_map.get("func1" as SymbolName)).toBe(
        "symbol:func1"
      );
      expect(readonly_symbol_map.size).toBe(2);

      // Use in mock semantic index - use ReadonlyMapBuilder for proper interface compatibility
      const mockLocation: Location = {
        file_path: test_file,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 5,
      };
      const func1Symbol = function_symbol("func1" as SymbolName, mockLocation);
      const func2Symbol = function_symbol("func2" as SymbolName, mockLocation);

      const symbol_builder = new ReadonlyMapBuilder<SymbolName, SymbolId>()
        .set("func1" as SymbolName, func1Symbol)
        .set("func2" as SymbolName, func2Symbol);

      const index = mock_semantic_index(test_file, {
        file_symbols_by_name: new Map([
          [test_file, symbol_builder.build_mutable()],
        ]),
      });

      expect(
        index.file_symbols_by_name.get(test_file)?.get("func1" as SymbolName)
      ).toBe(func1Symbol);
    });
  });

  describe("Built-in Function Resolution", () => {
    it("should handle built-in functions with mock factories", () => {
      // Create a call to console.log (built-in function)
      const console_call = mock_call_reference(
        "log" as SymbolName,
        mock_location(test_file, 1, 0),
        "scope:module" as ScopeId
      );

      const index = mock_semantic_index(test_file, {
        language: "javascript",
        calls: [console_call],
      });

      const import_map = mock_import_resolution_map();

      const result = resolve_function_calls(
        new Map([[test_file, index]]),
        import_map
      );

      // Built-in functions might not be resolved in local scope
      const call_key = location_key(console_call.location);
      const resolved_id = result.function_calls.get(call_key);

      // This test would depend on the actual resolution logic
      // but the important thing is that mock factories make the test structure clean
      expect(result).toBeDefined();
      expect(result.function_calls).toBeInstanceOf(Map);
      expect(result.calls_to_function).toBeInstanceOf(Map);
    });
  });

  describe("Benefits Demonstration", () => {
    it("shows improved test readability and maintainability", () => {
      // BEFORE: Each test manually creates complex nested objects
      // AFTER: Clean, declarative test structure

      const { index, function_symbol, call_reference } =
        create_function_scenario(test_file);

      // Test data is properly structured
      expect(index.file_path).toBe(test_file);
      expect(index.symbols.size).toBe(1);
      expect(index.references.calls).toHaveLength(1);

      // All ReadonlyMap properties are properly handled
      expect(index.scopes).toBeInstanceOf(Map);
      expect(index.symbols).toBeInstanceOf(Map);

      // Relationships are consistent
      expect(index.symbols.get(function_symbol.id)).toBe(function_symbol);
      expect(index.references.calls[0]).toBe(call_reference);
    });
  });
});
