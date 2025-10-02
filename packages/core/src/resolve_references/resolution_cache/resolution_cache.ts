/**
 * Resolution Cache
 *
 * Stores resolved (scope_id, name) → symbol_id mappings.
 * Provides O(1) lookup performance for repeated symbol resolutions.
 */

import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Cache statistics for debugging and monitoring
 */
export interface CacheStats {
  total_entries: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number; // hits / (hits + misses)
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
 */
export function create_resolution_cache(): ResolutionCache {
  // Internal storage: composite key -> symbol_id
  const cache = new Map<string, SymbolId>();

  // Track which keys belong to which files (for invalidation)
  const file_keys = new Map<FilePath, Set<string>>();

  // Statistics
  let hit_count = 0;
  let miss_count = 0;

  /**
   * Create composite key from scope_id and name
   */
  function make_key(scope_id: ScopeId, name: SymbolName): string {
    return `${scope_id}:${name}`;
  }

  /**
   * Extract file path from scope_id
   * Assumes scope_id format: "scope:file_path:..."
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
