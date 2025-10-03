/**
 * Resolution Cache - Fast lookup for resolved symbols
 *
 * Stores resolved (scope_id, name) → symbol_id mappings to avoid redundant resolution work.
 * All resolvers share the same cache for consistency and performance.
 *
 * ## Cache Strategy
 *
 * ### Cache Key Generation
 * Cache keys are composite strings: `"${scope_id}:${name}"`
 * This ensures the same name in different scopes can have different resolutions.
 *
 * Example:
 * - Scope "scope:app.ts:main", name "foo" → key "scope:app.ts:main:foo"
 * - Scope "scope:app.ts:helper", name "foo" → key "scope:app.ts:helper:foo"
 *
 * ### Invalidation
 * Cache supports file-level invalidation for incremental updates.
 * When a file changes, all cache entries for scopes in that file are cleared.
 * This is implemented by tracking which cache keys belong to which files.
 *
 * ### Performance
 * - Lookup: O(1) via Map.get()
 * - Store: O(1) via Map.set()
 * - Invalidate file: O(k) where k = entries for that file
 * - Typical cache hit rate: 80%+ (repeated references benefit)
 *
 * ### Statistics
 * Cache tracks hit/miss counts to measure effectiveness.
 * Use `get_stats()` to monitor cache performance in production.
 */

import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Cache statistics for debugging and monitoring
 *
 * Use these stats to measure cache effectiveness and identify performance bottlenecks.
 * A low hit rate might indicate the cache is being cleared too frequently or that
 * symbol references are very diverse (few repeated lookups).
 */
export interface CacheStats {
  /** Total number of entries currently stored in the cache */
  total_entries: number;

  /** Number of successful cache lookups (symbol was already cached) */
  hit_count: number;

  /** Number of cache misses (symbol had to be resolved) */
  miss_count: number;

  /** Hit rate as a fraction: hits / (hits + misses). Typical range: 0.7-0.9 */
  hit_rate: number;
}

/**
 * Resolution Cache Interface
 *
 * Stores resolved (scope_id, name) → symbol_id mappings.
 * Shared across all resolvers for consistency and performance.
 */
export interface ResolutionCache {
  /**
   * Get cached resolution
   * Returns undefined if not in cache (not null - undefined means cache miss)
   */
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined;

  /**
   * Store resolved symbol_id in cache
   */
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void;

  /**
   * Check if resolution exists in cache
   */
  has(scope_id: ScopeId, name: SymbolName): boolean;

  /**
   * Invalidate all cache entries for a file
   * Used when file changes during incremental updates
   */
  invalidate_file(file_path: FilePath): void;

  /**
   * Clear entire cache
   */
  clear(): void;

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  get_stats(): CacheStats;
}

/**
 * Create a new resolution cache
 *
 * Returns a ResolutionCache implementation with in-memory storage and file-level invalidation.
 *
 * @returns ResolutionCache instance ready for use
 *
 * @example
 * ```typescript
 * const cache = create_resolution_cache();
 *
 * // Store a resolution
 * cache.set("scope:app.ts:main", "foo", "fn:utils.ts:foo:10:0");
 *
 * // Retrieve it later (O(1))
 * const result = cache.get("scope:app.ts:main", "foo");
 * // → "fn:utils.ts:foo:10:0"
 *
 * // Check performance
 * console.log(cache.get_stats());
 * // → { total_entries: 150, hit_count: 1200, miss_count: 150, hit_rate: 0.89 }
 * ```
 */
export function create_resolution_cache(): ResolutionCache {
  // Internal storage: composite key → symbol_id
  // Key format: "${scope_id}:${name}" ensures unique lookup per (scope, name) pair
  const cache = new Map<string, SymbolId>();

  // Track which cache keys belong to which files (for invalidation)
  // When a file changes, we can quickly find and remove all its cache entries
  const file_keys = new Map<FilePath, Set<string>>();

  // Statistics counters for monitoring cache effectiveness
  let hit_count = 0;
  let miss_count = 0;

  /**
   * Create composite key from scope_id and name
   *
   * Cache key format: "${scope_id}:${name}"
   * This ensures the same symbol name in different scopes has different cache entries.
   *
   * Example:
   * - make_key("scope:app.ts:main", "foo") → "scope:app.ts:main:foo"
   * - make_key("scope:app.ts:helper", "foo") → "scope:app.ts:helper:foo"
   */
  function make_key(scope_id: ScopeId, name: SymbolName): string {
    return `${scope_id}:${name}`;
  }

  /**
   * Extract file path from scope_id
   *
   * Assumes scope_id format: "scope:file_path:..."
   * This is used to track which cache keys belong to which files for invalidation.
   *
   * Example:
   * - extract_file_path("scope:src/app.ts:main:10:0") → "src/app.ts"
   * - extract_file_path("scope:utils.ts:root") → "utils.ts"
   *
   * @returns FilePath if scope_id is valid, null otherwise
   */
  function extract_file_path(scope_id: ScopeId): FilePath | null {
    const parts = scope_id.split(":");
    if (parts.length >= 2 && parts[0] === "scope") {
      return parts[1] as FilePath;
    }
    return null;
  }

  return {
    get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined {
      const key = make_key(scope_id, name);
      const value = cache.get(key);

      if (value !== undefined) {
        hit_count++;
      } else {
        miss_count++;
      }

      return value;
    },

    set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void {
      const key = make_key(scope_id, name);
      cache.set(key, symbol_id);

      // Track key for file invalidation
      const file_path = extract_file_path(scope_id);
      if (file_path) {
        if (!file_keys.has(file_path)) {
          file_keys.set(file_path, new Set());
        }
        file_keys.get(file_path)!.add(key);
      }
    },

    has(scope_id: ScopeId, name: SymbolName): boolean {
      const key = make_key(scope_id, name);
      return cache.has(key);
    },

    invalidate_file(file_path: FilePath): void {
      const keys = file_keys.get(file_path);
      if (!keys) return;

      // Remove all keys for this file
      for (const key of keys) {
        cache.delete(key);
      }

      // Remove file tracking
      file_keys.delete(file_path);
    },

    clear(): void {
      cache.clear();
      file_keys.clear();
      hit_count = 0;
      miss_count = 0;
    },

    get_stats(): CacheStats {
      const total = hit_count + miss_count;
      return {
        total_entries: cache.size,
        hit_count,
        miss_count,
        hit_rate: total > 0 ? hit_count / total : 0,
      };
    },
  };
}
