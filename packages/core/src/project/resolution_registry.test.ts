import { describe, it, expect, beforeEach } from "vitest";
import { ResolutionRegistry } from "./resolution_registry";
import { function_symbol, reference_id } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";

describe("ResolutionRegistry", () => {
  let registry: ResolutionRegistry;

  beforeEach(() => {
    registry = new ResolutionRegistry();
  });

  describe("set and get", () => {
    it("should store and retrieve resolutions", () => {
      const file1 = "file1.ts" as FilePath;
      const ref_id = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const symbol_id = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });

      registry.set(ref_id, symbol_id, file1);

      expect(registry.get(ref_id)).toBe(symbol_id);
    });

    it("should return undefined for unknown reference", () => {
      const file1 = "test.ts" as FilePath;
      const ref_id = reference_id("unknown", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 1,
        end_column: 7,
      });
      expect(registry.get(ref_id)).toBeUndefined();
    });
  });

  describe("update_file", () => {
    it("should update resolutions for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const ref1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const sym1 = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });

      const resolutions = new Map([[ref1, sym1]]);
      registry.update_file(file1, resolutions);

      expect(registry.get(ref1)).toBe(sym1);
    });

    it("should replace old resolutions on update", () => {
      const file1 = "file1.ts" as FilePath;
      const ref1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const ref2 = reference_id("bar", {
        file_path: file1,
        start_line: 6,
        start_column: 10,
        end_line: 6,
        end_column: 13,
      });
      const sym1 = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const sym2 = function_symbol("bar", {
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 4,
        end_column: 1,
      });

      // First update
      registry.update_file(file1, new Map([[ref1, sym1]]));
      expect(registry.get(ref1)).toBe(sym1);

      // Second update (replaces first)
      registry.update_file(file1, new Map([[ref2, sym2]]));
      expect(registry.get(ref1)).toBeUndefined();
      expect(registry.get(ref2)).toBe(sym2);
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const ref1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const ref2 = reference_id("bar", {
        file_path: file2,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const sym1 = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const sym2 = function_symbol("bar", {
        file_path: file2,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });

      registry.update_file(file1, new Map([[ref1, sym1]]));
      registry.update_file(file2, new Map([[ref2, sym2]]));

      // Update file1
      registry.update_file(file1, new Map());

      expect(registry.get(ref1)).toBeUndefined();
      expect(registry.get(ref2)).toBe(sym2); // file2 unaffected
    });
  });

  describe("get_file_resolutions", () => {
    it("should return all resolutions for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const ref1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const ref2 = reference_id("bar", {
        file_path: file1,
        start_line: 6,
        start_column: 10,
        end_line: 6,
        end_column: 13,
      });
      const symbol1 = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const symbol2 = function_symbol("bar", {
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 4,
        end_column: 1,
      });

      registry.set(ref1, symbol1, file1);
      registry.set(ref2, symbol2, file1);

      const resolutions = registry.get_file_resolutions(file1);
      expect(resolutions.size).toBe(2);
      expect(resolutions.get(ref1)).toBe(symbol1);
      expect(resolutions.get(ref2)).toBe(symbol2);
    });

    it("should return empty map for unknown file", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(registry.get_file_resolutions(unknown_file).size).toBe(0);
    });
  });

  describe("remove_file", () => {
    it("should remove all resolutions for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const ref1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const ref2 = reference_id("bar", {
        file_path: file2,
        start_line: 6,
        start_column: 10,
        end_line: 6,
        end_column: 13,
      });
      const symbol1 = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const symbol2 = function_symbol("bar", {
        file_path: file2,
        start_line: 2,
        start_column: 0,
        end_line: 4,
        end_column: 1,
      });

      registry.set(ref1, symbol1, file1);
      registry.set(ref2, symbol2, file2);

      expect(registry.size()).toBe(2);
      expect(registry.get(ref1)).toBe(symbol1);
      expect(registry.get(ref2)).toBe(symbol2);

      registry.remove_file(file1);

      expect(registry.size()).toBe(1);
      expect(registry.get(ref1)).toBeUndefined();
      expect(registry.get(ref2)).toBe(symbol2);
    });
  });

  describe("get_stats", () => {
    it("should return accurate statistics", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      registry.set(
        reference_id("foo", {
          file_path: file1,
          start_line: 5,
          start_column: 10,
          end_line: 5,
          end_column: 13,
        }),
        function_symbol("foo", {
          file_path: file1,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        }),
        file1
      );

      registry.set(
        reference_id("bar", {
          file_path: file2,
          start_line: 5,
          start_column: 10,
          end_line: 5,
          end_column: 13,
        }),
        function_symbol("bar", {
          file_path: file2,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        }),
        file2
      );

      const stats = registry.get_stats();
      expect(stats.total_resolutions).toBe(2);
      expect(stats.files_with_resolutions).toBe(2);
    });

    it("should not have pending_files field", () => {
      const stats = registry.get_stats();
      expect(stats).not.toHaveProperty("pending_files");
    });
  });

  describe("clear", () => {
    it("should remove all resolutions", () => {
      const file1 = "file1.ts" as FilePath;
      const ref_id = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const symbol_id = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });

      registry.set(ref_id, symbol_id, file1);

      expect(registry.size()).toBe(1);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.get_stats().total_resolutions).toBe(0);
      expect(registry.get_stats().files_with_resolutions).toBe(0);
    });
  });

  describe("has_resolution", () => {
    it("should return true for stored references", () => {
      const file1 = "file1.ts" as FilePath;
      const ref_id = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const symbol_id = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });

      registry.set(ref_id, symbol_id, file1);

      expect(registry.has_resolution(ref_id)).toBe(true);
    });

    it("should return false for unknown references", () => {
      const file1 = "file1.ts" as FilePath;
      const ref_id = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });

      expect(registry.has_resolution(ref_id)).toBe(false);
    });
  });

  describe("get_all_referenced_symbols", () => {
    it("should return all unique referenced symbols", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const ref_id1 = reference_id("foo", {
        file_path: file1,
        start_line: 5,
        start_column: 10,
        end_line: 5,
        end_column: 13,
      });
      const ref_id2 = reference_id("bar", {
        file_path: file1,
        start_line: 6,
        start_column: 10,
        end_line: 6,
        end_column: 13,
      });
      const ref_id3 = reference_id("foo", {
        file_path: file2,
        start_line: 3,
        start_column: 5,
        end_line: 3,
        end_column: 8,
      });

      const symbol_A = function_symbol("foo", {
        file_path: file1,
        start_line: 1,
        start_column: 0,
        end_line: 3,
        end_column: 1,
      });
      const symbol_B = function_symbol("bar", {
        file_path: file1,
        start_line: 4,
        start_column: 0,
        end_line: 6,
        end_column: 1,
      });

      registry.set(ref_id1, symbol_A, file1);
      registry.set(ref_id2, symbol_B, file1);
      registry.set(ref_id3, symbol_A, file2); // Duplicate symbol_A

      const referenced = registry.get_all_referenced_symbols();

      expect(referenced.size).toBe(2);
      expect(referenced.has(symbol_A)).toBe(true);
      expect(referenced.has(symbol_B)).toBe(true);
    });

    it("should return empty set when no resolutions", () => {
      const referenced = registry.get_all_referenced_symbols();
      expect(referenced.size).toBe(0);
    });
  });
});
