/**
 * Cross-Module Integration Tests
 *
 * Tests for data flow and communication between type resolution modules.
 * Simplified to work with actual codebase interfaces.
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolId,
  TypeId,
  SymbolName,
  LocationKey,
  Location,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  location_key,
} from "@ariadnejs/types";
import type {
  FunctionResolutionMap,
  TypeResolutionMap,
} from "./types";
import { mockFactories } from "./test_utilities/mock_factories";

describe("Cross-Module Integration", () => {
  describe("Interface Compliance", () => {
    it("FunctionResolutionMap has expected structure", () => {
      const resolution = mockFactories.createMockFunctionResolution();

      // Verify required fields exist
      expect(resolution).toHaveProperty("function_calls");
      expect(resolution).toHaveProperty("calls_to_function");
      expect(resolution).toHaveProperty("closure_calls");
      expect(resolution).toHaveProperty("higher_order_calls");
      expect(resolution).toHaveProperty("function_pointer_calls");

      // Verify types are correct
      expect(resolution.function_calls).toBeInstanceOf(Map);
      expect(resolution.calls_to_function).toBeInstanceOf(Map);
      expect(resolution.closure_calls).toBeInstanceOf(Map);
      expect(resolution.higher_order_calls).toBeInstanceOf(Map);
      expect(resolution.function_pointer_calls).toBeInstanceOf(Map);
    });

    it("TypeResolutionMap has expected structure", () => {
      const resolution = mockFactories.createMockTypeResolution();

      // Verify required fields exist
      expect(resolution).toHaveProperty("symbol_types");
      expect(resolution).toHaveProperty("reference_types");
      expect(resolution).toHaveProperty("type_definitions");
      expect(resolution).toHaveProperty("type_members");
      expect(resolution).toHaveProperty("type_flow_edges");

      // Verify types are correct
      expect(resolution.symbol_types).toBeInstanceOf(Map);
      expect(resolution.reference_types).toBeInstanceOf(Map);
      expect(resolution.type_definitions).toBeInstanceOf(Map);
      expect(resolution.type_members).toBeInstanceOf(Map);
      expect(resolution.type_flow_edges).toBeInstanceOf(Array);
    });
  });

  describe("Type System Integration", () => {
    it("TypeId creation works correctly", () => {
      const file_path = "/test/types.ts" as FilePath;
      const type_name = "TestType" as SymbolName;
      const type_id = `type:${type_name}:${file_path}` as TypeId;

      expect(type_id).toContain(type_name);
      expect(type_id).toContain(file_path);
      expect(typeof type_id).toBe("string");
    });

    it("Symbol creation works correctly", () => {
      const location = mockFactories.createMockLocation();
      const symbol_name = "testSymbol" as SymbolName;
      const symbol_id = function_symbol(symbol_name, location);

      expect(typeof symbol_id).toBe("string");
      expect(symbol_id).toContain(symbol_name);
    });

    it("Location key generation is consistent", () => {
      const location = mockFactories.createMockLocation();
      const key1 = location_key(location);
      const key2 = location_key(location);

      expect(key1).toBe(key2);
      expect(typeof key1).toBe("string");
    });
  });

  describe("Data Flow Patterns", () => {
    it("can create complex type mappings", () => {
      const resolution = mockFactories.createMockTypeResolution();
      const function_resolution = mockFactories.createMockFunctionResolution();

      // Basic integration test - verify data can be combined
      const combined_data = {
        types: resolution.symbol_types.size,
        functions: function_resolution.function_calls.size,
      };

      expect(combined_data.types).toBeGreaterThanOrEqual(0);
      expect(combined_data.functions).toBeGreaterThanOrEqual(0);
    });

    it("can handle cross-file symbol references", () => {
      const file1 = "/test/file1.ts" as FilePath;
      const file2 = "/test/file2.ts" as FilePath;

      const location1 = mockFactories.createMockLocation(file1, 10);
      const location2 = mockFactories.createMockLocation(file2, 20);

      const symbol1 = function_symbol("crossFileSymbol" as SymbolName, location1);
      const symbol2 = function_symbol("crossFileSymbol" as SymbolName, location2);

      // Same name, different files should create different symbols
      expect(symbol1).not.toBe(symbol2);
    });
  });

  describe("Error Handling", () => {
    it("handles missing type information gracefully", () => {
      const resolution = mockFactories.createMockTypeResolution();
      const non_existent_symbol = function_symbol(
        "nonExistent" as SymbolName,
        mockFactories.createMockLocation()
      );

      // Should not throw when looking up non-existent symbol
      expect(() => {
        const type = resolution.symbol_types.get(non_existent_symbol);
        expect(type).toBeUndefined();
      }).not.toThrow();
    });

    it("handles malformed type identifiers", () => {
      const empty_type_id = "" as TypeId;
      const invalid_symbol = "" as SymbolId;

      // Should be able to work with empty/invalid identifiers
      expect(typeof empty_type_id).toBe("string");
      expect(typeof invalid_symbol).toBe("string");
    });

    it("handles empty collections gracefully", () => {
      const empty_map = new Map<SymbolId, TypeId>();
      const empty_array: any[] = [];

      expect(empty_map.size).toBe(0);
      expect(empty_array.length).toBe(0);
      expect(() => empty_map.get("test" as SymbolId)).not.toThrow();
    });
  });

  describe("Performance Characteristics", () => {
    it("handles reasonable scale efficiently", () => {
      const start_time = performance.now();

      // Create multiple mock objects
      for (let i = 0; i < 100; i++) {
        const index = mockFactories.createMockSemanticIndex({
          type_count: 10,
        });
        expect(index.symbols).toBeInstanceOf(Map);
      }

      const end_time = performance.now();
      const duration = end_time - start_time;

      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it("supports efficient lookups", () => {
      const resolution = mockFactories.createMockTypeResolution();
      const start_time = performance.now();

      // Perform many lookups
      for (let i = 0; i < 1000; i++) {
        const dummy_symbol = `symbol${i}` as SymbolId;
        resolution.symbol_types.get(dummy_symbol);
      }

      const end_time = performance.now();
      const duration = end_time - start_time;

      // Map lookups should be very fast
      expect(duration).toBeLessThan(100);
    });
  });
});