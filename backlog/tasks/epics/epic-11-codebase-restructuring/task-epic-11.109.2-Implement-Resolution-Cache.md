# Task 11.109.2: Implement Resolution Cache

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 1-2 days
**Parent:** task-epic-11.109
**Dependencies:** task-epic-11.109.0 (File Structure)

## Objective

Implement `resolution_cache.ts` - a simple cache that stores resolved `(scope_id, name) → symbol_id` mappings. This provides O(1) lookup performance for repeated symbol resolutions.

## Files to Create

**This task creates exactly ONE code file:**

- `packages/core/src/resolve_references/resolution_cache/resolution_cache.ts`
- `packages/core/src/resolve_references/resolution_cache/resolution_cache.test.ts`

## Implementation

### Core Interface

```typescript
import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Resolution Cache
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

export interface CacheStats {
  total_entries: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number; // hits / (hits + misses)
}
```

### Implementation

```typescript
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
```

## Test Coverage

### Unit Tests (`resolution_cache.test.ts`)

**Basic Operations:**
1. ✅ Create empty cache
2. ✅ Set and get single entry
3. ✅ Get non-existent entry returns undefined
4. ✅ has() returns true/false correctly
5. ✅ Multiple entries in same scope
6. ✅ Same name in different scopes (different entries)

**Cache Hits/Misses:**
7. ✅ First get is miss, second get is hit
8. ✅ Statistics track hits and misses correctly
9. ✅ Hit rate calculated correctly

**Invalidation:**
10. ✅ Invalidate file removes all entries for that file
11. ✅ Invalidate file doesn't affect other files
12. ✅ Clear removes all entries
13. ✅ Clear resets statistics

**Edge Cases:**
14. ✅ Set same (scope, name) twice overwrites
15. ✅ Invalidate non-existent file is no-op
16. ✅ Large cache (10,000+ entries) performs well

**File Path Extraction:**
17. ✅ Extract file path from scope_id correctly
18. ✅ Handle scope_ids without file path gracefully

## Success Criteria

- ✅ Single file created: `resolution_cache.ts`
- ✅ All interface methods implemented
- ✅ O(1) get/set performance
- ✅ File invalidation works correctly
- ✅ Statistics tracking accurate
- ✅ 100% line coverage
- ✅ 100% branch coverage
- ✅ Performance test with 10,000+ entries
- ✅ Pythonic naming convention

## Technical Notes

### Composite Key Design

The cache uses a simple string composite key: `"${scope_id}:${name}"

This is efficient because:
- String concatenation is fast in modern JavaScript
- Map lookups on strings are O(1)
- No need for complex hashing

### File Invalidation

File invalidation is critical for incremental updates:
```typescript
// User edits file
const file_path = "src/app.ts";

// Invalidate all cached resolutions for that file
cache.invalidate_file(file_path);

// Next resolutions will be fresh
```

### Cache Statistics

Statistics help monitor performance:
```typescript
const stats = cache.get_stats();
console.log(`Cache hit rate: ${(stats.hit_rate * 100).toFixed(1)}%`);
// Expected: 80-95% hit rate in typical usage
```

## Dependencies

**Uses:**
- `@ariadnejs/types` (SymbolId, SymbolName, ScopeId, FilePath)

**Consumed by:**
- task-epic-11.109.1 (Scope Resolver Index)
- task-epic-11.109.4 (Type Context)
- task-epic-11.109.5 (Function Call Resolution)
- task-epic-11.109.6 (Method Call Resolution)
- task-epic-11.109.7 (Constructor Call Resolution)

## Next Steps

After completion:
- All resolvers will use this cache
- Expected 80%+ cache hit rates
- Significant performance improvement for repeated resolutions
