/**
 * Tests for Resolution Cache
 */

import { describe, it, expect } from "vitest";
import { create_resolution_cache } from "./resolution_cache";
import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

describe("ResolutionCache", () => {
  // Helper to create test data
  const scope1 = "scope:src/app.ts:0" as ScopeId;
  const scope2 = "scope:src/utils.ts:0" as ScopeId;
  const scope3 = "scope:src/app.ts:100" as ScopeId; // Different scope, same file as scope1
  const name1 = "foo" as SymbolName;
  const name2 = "bar" as SymbolName;
  const symbol1 = "symbol:src/app.ts:foo:0" as SymbolId;
  const symbol2 = "symbol:src/utils.ts:bar:10" as SymbolId;
  const symbol3 = "symbol:src/app.ts:foo:20" as SymbolId;

  describe("Basic Operations", () => {
    it("creates empty cache", () => {
      const cache = create_resolution_cache();
      const stats = cache.get_stats();

      expect(stats.total_entries).toBe(0);
      expect(stats.hit_count).toBe(0);
      expect(stats.miss_count).toBe(0);
      expect(stats.hit_rate).toBe(0);
    });

    it("sets and gets single entry", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      const result = cache.get(scope1, name1);

      expect(result).toBe(symbol1);
    });

    it("returns undefined for non-existent entry", () => {
      const cache = create_resolution_cache();

      const result = cache.get(scope1, name1);

      expect(result).toBeUndefined();
    });

    it("has() returns true/false correctly", () => {
      const cache = create_resolution_cache();

      expect(cache.has(scope1, name1)).toBe(false);

      cache.set(scope1, name1, symbol1);

      expect(cache.has(scope1, name1)).toBe(true);
      expect(cache.has(scope1, name2)).toBe(false);
    });

    it("stores multiple entries in same scope", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.set(scope1, name2, symbol2);

      expect(cache.get(scope1, name1)).toBe(symbol1);
      expect(cache.get(scope1, name2)).toBe(symbol2);
      expect(cache.get_stats().total_entries).toBe(2);
    });

    it("treats same name in different scopes as different entries", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.set(scope2, name1, symbol2);

      expect(cache.get(scope1, name1)).toBe(symbol1);
      expect(cache.get(scope2, name1)).toBe(symbol2);
      expect(cache.get_stats().total_entries).toBe(2);
    });
  });

  describe("Cache Hits/Misses", () => {
    it("tracks first get as miss, second get as hit", () => {
      const cache = create_resolution_cache();
      cache.set(scope1, name1, symbol1);

      // First get - should be a hit (value exists)
      const result1 = cache.get(scope1, name1);
      expect(result1).toBe(symbol1);

      let stats = cache.get_stats();
      expect(stats.hit_count).toBe(1);
      expect(stats.miss_count).toBe(0);

      // Second get - another hit
      const result2 = cache.get(scope1, name1);
      expect(result2).toBe(symbol1);

      stats = cache.get_stats();
      expect(stats.hit_count).toBe(2);
      expect(stats.miss_count).toBe(0);
    });

    it("tracks misses correctly", () => {
      const cache = create_resolution_cache();

      // Get non-existent entry - miss
      const result1 = cache.get(scope1, name1);
      expect(result1).toBeUndefined();

      let stats = cache.get_stats();
      expect(stats.hit_count).toBe(0);
      expect(stats.miss_count).toBe(1);

      // Another miss
      const result2 = cache.get(scope2, name2);
      expect(result2).toBeUndefined();

      stats = cache.get_stats();
      expect(stats.hit_count).toBe(0);
      expect(stats.miss_count).toBe(2);
    });

    it("calculates hit rate correctly", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);

      // 1 hit
      cache.get(scope1, name1);
      expect(cache.get_stats().hit_rate).toBe(1.0);

      // 1 miss
      cache.get(scope2, name2);
      expect(cache.get_stats().hit_rate).toBe(0.5);

      // 2 more hits
      cache.get(scope1, name1);
      cache.get(scope1, name1);
      expect(cache.get_stats().hit_rate).toBe(0.75); // 3 hits, 1 miss
    });

    it("has() does not affect hit/miss stats", () => {
      const cache = create_resolution_cache();
      cache.set(scope1, name1, symbol1);

      cache.has(scope1, name1);
      cache.has(scope2, name2);

      const stats = cache.get_stats();
      expect(stats.hit_count).toBe(0);
      expect(stats.miss_count).toBe(0);
    });
  });

  describe("Invalidation", () => {
    it("invalidates all entries for a file", () => {
      const cache = create_resolution_cache();

      // Add entries for src/app.ts (scope1 and scope3)
      cache.set(scope1, name1, symbol1);
      cache.set(scope3, name2, symbol3);

      // Add entry for different file
      cache.set(scope2, name1, symbol2);

      expect(cache.get_stats().total_entries).toBe(3);

      // Invalidate src/app.ts
      cache.invalidate_file("src/app.ts" as FilePath);

      // Entries for src/app.ts should be gone
      expect(cache.has(scope1, name1)).toBe(false);
      expect(cache.has(scope3, name2)).toBe(false);

      // Entry for src/utils.ts should remain
      expect(cache.has(scope2, name1)).toBe(true);
      expect(cache.get_stats().total_entries).toBe(1);
    });

    it("invalidate_file doesn't affect other files", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.set(scope2, name1, symbol2);

      cache.invalidate_file("src/app.ts" as FilePath);

      expect(cache.get(scope2, name1)).toBe(symbol2);
    });

    it("invalidates non-existent file without error", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);

      expect(() => {
        cache.invalidate_file("src/nonexistent.ts" as FilePath);
      }).not.toThrow();

      expect(cache.get(scope1, name1)).toBe(symbol1);
    });

    it("clears all entries", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.set(scope2, name2, symbol2);

      expect(cache.get_stats().total_entries).toBe(2);

      cache.clear();

      expect(cache.get_stats().total_entries).toBe(0);
      expect(cache.has(scope1, name1)).toBe(false);
      expect(cache.has(scope2, name2)).toBe(false);
    });

    it("clear resets statistics", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.get(scope1, name1); // hit
      cache.get(scope2, name2); // miss

      let stats = cache.get_stats();
      expect(stats.hit_count).toBe(1);
      expect(stats.miss_count).toBe(1);

      cache.clear();

      stats = cache.get_stats();
      expect(stats.hit_count).toBe(0);
      expect(stats.miss_count).toBe(0);
      expect(stats.hit_rate).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("overwrites when setting same (scope, name) twice", () => {
      const cache = create_resolution_cache();

      cache.set(scope1, name1, symbol1);
      cache.set(scope1, name1, symbol2); // Overwrite

      expect(cache.get(scope1, name1)).toBe(symbol2);
      expect(cache.get_stats().total_entries).toBe(1);
    });

    it("handles large cache efficiently", () => {
      const cache = create_resolution_cache();
      const entry_count = 10000;

      // Add 10,000 entries
      const start = performance.now();
      for (let i = 0; i < entry_count; i++) {
        const scope = `scope:src/file${i % 100}.ts:${i}` as ScopeId;
        const name = `symbol${i}` as SymbolName;
        const symbol = `symbol:src/file${i % 100}.ts:symbol${i}:${i}` as SymbolId;
        cache.set(scope, name, symbol);
      }
      const set_time = performance.now() - start;

      expect(cache.get_stats().total_entries).toBe(entry_count);

      // Verify lookups are fast
      const lookup_start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const scope = `scope:src/file${i % 100}.ts:${i}` as ScopeId;
        const name = `symbol${i}` as SymbolName;
        cache.get(scope, name);
      }
      const lookup_time = performance.now() - lookup_start;

      // Performance sanity checks (generous limits)
      expect(set_time).toBeLessThan(1000); // 1 second for 10k inserts
      expect(lookup_time).toBeLessThan(100); // 100ms for 1k lookups
    });

    it("handles scope IDs without file path gracefully", () => {
      const cache = create_resolution_cache();

      // Scope without proper format
      const weird_scope = "global" as ScopeId;

      cache.set(weird_scope, name1, symbol1);

      expect(cache.get(weird_scope, name1)).toBe(symbol1);
      expect(cache.has(weird_scope, name1)).toBe(true);

      // Invalidation shouldn't crash
      expect(() => {
        cache.invalidate_file("src/app.ts" as FilePath);
      }).not.toThrow();

      // Entry should still exist (wasn't associated with a file)
      expect(cache.get(weird_scope, name1)).toBe(symbol1);
    });

    it("handles empty scope ID", () => {
      const cache = create_resolution_cache();

      const empty_scope = "" as ScopeId;
      cache.set(empty_scope, name1, symbol1);

      expect(cache.get(empty_scope, name1)).toBe(symbol1);
    });

    it("handles empty symbol name", () => {
      const cache = create_resolution_cache();

      const empty_name = "" as SymbolName;
      cache.set(scope1, empty_name, symbol1);

      expect(cache.get(scope1, empty_name)).toBe(symbol1);
    });

    it("handles special characters in names", () => {
      const cache = create_resolution_cache();

      const special_name = "foo:bar:baz" as SymbolName;
      cache.set(scope1, special_name, symbol1);

      expect(cache.get(scope1, special_name)).toBe(symbol1);
    });
  });

  describe("File Path Extraction", () => {
    it("extracts file path from scope_id correctly", () => {
      const cache = create_resolution_cache();

      const scope_a = "scope:src/a.ts:100" as ScopeId;
      const scope_b = "scope:src/b.ts:200" as ScopeId;

      cache.set(scope_a, name1, symbol1);
      cache.set(scope_b, name1, symbol2);

      // Invalidate file a
      cache.invalidate_file("src/a.ts" as FilePath);

      expect(cache.has(scope_a, name1)).toBe(false);
      expect(cache.has(scope_b, name1)).toBe(true);
    });

    it("handles deep file paths", () => {
      const cache = create_resolution_cache();

      const deep_scope = "scope:src/deeply/nested/path/file.ts:0" as ScopeId;
      cache.set(deep_scope, name1, symbol1);

      cache.invalidate_file("src/deeply/nested/path/file.ts" as FilePath);

      expect(cache.has(deep_scope, name1)).toBe(false);
    });

    it("handles scope_id with multiple colons", () => {
      const cache = create_resolution_cache();

      const complex_scope = "scope:src/app.ts:class:MyClass:method:foo" as ScopeId;
      cache.set(complex_scope, name1, symbol1);

      cache.invalidate_file("src/app.ts" as FilePath);

      expect(cache.has(complex_scope, name1)).toBe(false);
    });

    it("handles invalidation of non-scope format IDs", () => {
      const cache = create_resolution_cache();

      const non_scope_id = "global:something" as ScopeId;
      cache.set(non_scope_id, name1, symbol1);

      // Should not crash, and entry should remain
      cache.invalidate_file("global" as FilePath);

      expect(cache.get(non_scope_id, name1)).toBe(symbol1);
    });
  });

  describe("Concurrent Access Patterns", () => {
    it("handles rapid sequential operations", () => {
      const cache = create_resolution_cache();

      // Simulate rapid operations
      for (let i = 0; i < 100; i++) {
        cache.set(scope1, name1, symbol1);
        cache.get(scope1, name1);
        cache.has(scope1, name1);
      }

      // Verify the value without affecting hit count
      expect(cache.has(scope1, name1)).toBe(true);
      expect(cache.get_stats().hit_count).toBe(100);

      // Final verification that get still works
      expect(cache.get(scope1, name1)).toBe(symbol1);
    });

    it("handles interleaved operations on multiple scopes", () => {
      const cache = create_resolution_cache();

      const scopes = [
        "scope:src/a.ts:0" as ScopeId,
        "scope:src/b.ts:0" as ScopeId,
        "scope:src/c.ts:0" as ScopeId,
      ];

      const symbols = [
        "symbol:src/a.ts:foo:0" as SymbolId,
        "symbol:src/b.ts:foo:0" as SymbolId,
        "symbol:src/c.ts:foo:0" as SymbolId,
      ];

      // Interleaved sets and gets
      for (let i = 0; i < scopes.length; i++) {
        cache.set(scopes[i], name1, symbols[i]);
        if (i > 0) {
          expect(cache.get(scopes[i - 1], name1)).toBe(symbols[i - 1]);
        }
      }

      // Verify all entries
      for (let i = 0; i < scopes.length; i++) {
        expect(cache.get(scopes[i], name1)).toBe(symbols[i]);
      }
    });

    it("maintains consistency during invalidation", () => {
      const cache = create_resolution_cache();

      // Set up entries for multiple files
      const file1_scope1 = "scope:src/a.ts:0" as ScopeId;
      const file1_scope2 = "scope:src/a.ts:100" as ScopeId;
      const file2_scope = "scope:src/b.ts:0" as ScopeId;

      cache.set(file1_scope1, name1, symbol1);
      cache.set(file1_scope2, name2, symbol2);
      cache.set(file2_scope, name1, symbol3);

      // Interleave gets and invalidation
      expect(cache.get(file1_scope1, name1)).toBe(symbol1);
      cache.invalidate_file("src/a.ts" as FilePath);
      expect(cache.get(file2_scope, name1)).toBe(symbol3);

      // Verify file1 entries are gone
      expect(cache.has(file1_scope1, name1)).toBe(false);
      expect(cache.has(file1_scope2, name2)).toBe(false);

      // file2 entry should still be there
      expect(cache.has(file2_scope, name1)).toBe(true);
    });
  });
});
