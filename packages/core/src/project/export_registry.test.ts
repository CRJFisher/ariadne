import { describe, it, expect, beforeEach } from "vitest";
import { ExportRegistry } from "./export_registry";
import { function_symbol, variable_symbol } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";

describe("ExportRegistry", () => {
  let registry: ExportRegistry;

  beforeEach(() => {
    registry = new ExportRegistry();
  });

  describe("update_file", () => {
    it("should store exports for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const var_id = variable_symbol("x", file1, { line: 2, column: 0 });

      const exported = new Set([func_id, var_id]);
      registry.update_file(file1, exported);

      const exports = registry.get_exports(file1);
      expect(exports.size).toBe(2);
      expect(exports.has(func_id)).toBe(true);
      expect(exports.has(var_id)).toBe(true);
    });

    it("should replace exports when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const func1 = function_symbol("foo", file1, { line: 1, column: 0 });
      const func2 = function_symbol("bar", file1, { line: 2, column: 0 });

      // First version
      registry.update_file(file1, new Set([func1]));
      expect(registry.get_exports(file1).size).toBe(1);

      // Second version (replace)
      registry.update_file(file1, new Set([func2]));

      const exports = registry.get_exports(file1);
      expect(exports.size).toBe(1);
      expect(exports.has(func1)).toBe(false);
      expect(exports.has(func2)).toBe(true);
    });

    it("should handle empty export set", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      // First add exports
      registry.update_file(file1, new Set([func_id]));
      expect(registry.get_file_count()).toBe(1);

      // Then update with empty set
      registry.update_file(file1, new Set());

      expect(registry.get_file_count()).toBe(0);
      expect(registry.get_exports(file1).size).toBe(0);
    });
  });

  describe("get_exports", () => {
    it("should return empty set for unknown file", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(registry.get_exports(unknown_file).size).toBe(0);
    });

    it("should return cloned set to prevent external mutations", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      registry.update_file(file1, new Set([func_id]));

      const exports1 = registry.get_exports(file1);
      const exports2 = registry.get_exports(file1);

      // Should be equal but not same reference
      expect(exports1).toEqual(exports2);
      expect(exports1).not.toBe(exports2);

      // Mutating one should not affect the other
      exports1.add(variable_symbol("x", file1, { line: 2, column: 0 }));
      expect(exports2.size).toBe(1);  // Unchanged
    });
  });

  describe("exports_symbol", () => {
    it("should return true for exported symbols", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      registry.update_file(file1, new Set([func_id]));

      expect(registry.exports_symbol(file1, func_id)).toBe(true);
    });

    it("should return false for non-exported symbols", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const other_id = function_symbol("bar", file1, { line: 2, column: 0 });

      registry.update_file(file1, new Set([func_id]));

      expect(registry.exports_symbol(file1, other_id)).toBe(false);
    });

    it("should return false for unknown file", () => {
      const unknown_file = "unknown.ts" as FilePath;
      const func_id = function_symbol("foo", "test.ts", { line: 1, column: 0 });

      expect(registry.exports_symbol(unknown_file, func_id)).toBe(false);
    });
  });

  describe("find_exporters", () => {
    it("should find all files that export a symbol", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      // Both files export the same symbol (e.g., re-exports)
      registry.update_file(file1, new Set([func_id]));
      registry.update_file(file2, new Set([func_id]));

      const exporters = registry.find_exporters(func_id);
      expect(exporters).toHaveLength(2);
      expect(exporters).toContain(file1);
      expect(exporters).toContain(file2);
    });

    it("should return empty array for non-exported symbol", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });
      const other_id = function_symbol("bar", file1, { line: 2, column: 0 });

      registry.update_file(file1, new Set([func_id]));

      expect(registry.find_exporters(other_id)).toEqual([]);
    });
  });

  describe("get_total_export_count", () => {
    it("should count total exports across all files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      registry.update_file(file1, new Set([
        function_symbol("foo", file1, { line: 1, column: 0 }),
        function_symbol("bar", file1, { line: 2, column: 0 }),
      ]));

      registry.update_file(file2, new Set([
        function_symbol("baz", file2, { line: 1, column: 0 }),
      ]));

      expect(registry.get_total_export_count()).toBe(3);
    });
  });

  describe("remove_file", () => {
    it("should remove all exports from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const func_id = function_symbol("foo", file1, { line: 1, column: 0 });

      registry.update_file(file1, new Set([func_id]));
      expect(registry.get_file_count()).toBe(1);

      registry.remove_file(file1);

      expect(registry.get_file_count()).toBe(0);
      expect(registry.get_exports(file1).size).toBe(0);
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const func1 = function_symbol("foo", file1, { line: 1, column: 0 });
      const func2 = function_symbol("bar", file2, { line: 1, column: 0 });

      registry.update_file(file1, new Set([func1]));
      registry.update_file(file2, new Set([func2]));

      registry.remove_file(file1);

      expect(registry.get_file_count()).toBe(1);
      expect(registry.get_exports(file2).has(func2)).toBe(true);
    });

    it("should handle removing non-existent file gracefully", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(() => registry.remove_file(unknown_file)).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should remove all exports", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      registry.update_file(file1, new Set([function_symbol("foo", file1, { line: 1, column: 0 })]));
      registry.update_file(file2, new Set([function_symbol("bar", file2, { line: 1, column: 0 })]));

      expect(registry.get_file_count()).toBe(2);

      registry.clear();

      expect(registry.get_file_count()).toBe(0);
      expect(registry.get_total_export_count()).toBe(0);
    });
  });
});
