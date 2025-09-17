/**
 * Tests for Symbol Utilities
 */

import { describe, it, expect } from "vitest";
import {
  SymbolId,
  SymbolName,
  function_symbol,
  method_symbol,
} from "./symbol";
import { Location } from "./common";
import { FilePath } from "./aliases";

describe("Symbol Utilities", () => {
  const test_location: Location = {
    file_path: "src/test.ts" as FilePath,
    line: 10,
    column: 5,
    end_line: 15,
    end_column: 10,
  };

  describe("Factory Functions", () => {
    describe("Symbol Format", () => {
      it("should maintain consistent format", () => {
        const func_symbol_result = function_symbol(
          "processData" as SymbolName,
          test_location
        );
        const expectedFormat = "function:src/test.ts:10:5:15:10:processData";

        expect(func_symbol_result).toBe(expectedFormat);
      });

      it("should handle qualified symbols correctly", () => {
        const method_symbol_result = method_symbol(
          "getValue",
          "MyClass",
          test_location
        );
        // Format: kind:file_path:line:column:end_line:end_column:name:qualifier
        const expectedFormat = "method:src/test.ts:10:5:15:10:getValue:MyClass";

        expect(method_symbol_result).toBe(expectedFormat);
      });
    });

    describe("Performance Considerations", () => {
      it("should use SymbolId directly for comparisons", () => {
        const symbol_1 = function_symbol("func" as SymbolName, test_location);
        const symbol_2 = function_symbol("func" as SymbolName, test_location);

        // Direct comparison (fast)
        const direct_comparison = symbol_1 === symbol_2;
        expect(direct_comparison).toBe(true);
      });

      it("should cache symbols for reuse", () => {
        // Simulate caching pattern
        const symbol_cache = new Map<string, SymbolId>();
        const key = "myFunc" as SymbolName;

        if (!symbol_cache.has(key)) {
          symbol_cache.set(key, function_symbol(key, test_location));
        }

        const cached = symbol_cache.get(key);
        expect(cached).toBeDefined();
      });
    });
  });
});
