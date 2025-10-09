# Task: Implement ResolutionCache

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: High
**Complexity**: Medium

## Overview

Implement a `ResolutionCache` that caches reference → symbol resolutions and tracks which files have valid cached resolutions. This cache enables lazy re-resolution by marking files as "pending" when their resolutions are invalidated.

## Goals

1. Cache reference → symbol resolutions for fast lookup
2. Track which files have pending (invalidated) resolutions
3. Support invalidation on file changes
4. Provide methods to check if a file is resolved

## Detailed Implementation Plan

### Step 1: Create ResolutionCache Class

**File**: `packages/core/src/project/resolution_cache.ts` (new file)

```typescript
import type { ReferenceId, SymbolId, FileId } from '@ariadnejs/types'

/**
 * Cache for reference → symbol resolutions.
 *
 * Tracks:
 * 1. Resolutions: ReferenceId → SymbolId mappings
 * 2. File ownership: Which references belong to which files
 * 3. Pending files: Files with invalidated resolutions
 *
 * Enables lazy re-resolution: mark files as pending, resolve on next query.
 */
export class ResolutionCache {
  /** Reference ID → resolved Symbol ID */
  private resolutions: Map<ReferenceId, SymbolId> = new Map()

  /** File → all reference IDs in that file */
  private by_file: Map<FileId, Set<ReferenceId>> = new Map()

  /** Files with invalidated resolutions (need re-resolution) */
  private pending: Set<FileId> = new Set()

  /**
   * Get cached resolution for a reference.
   *
   * @param ref_id - The reference to look up
   * @returns The resolved SymbolId, or undefined if not cached
   */
  get(ref_id: ReferenceId): SymbolId | undefined {
    return this.resolutions.get(ref_id)
  }

  /**
   * Cache a resolution.
   *
   * @param ref_id - The reference being resolved
   * @param symbol_id - The symbol it resolves to
   * @param file_id - The file containing the reference
   */
  set(ref_id: ReferenceId, symbol_id: SymbolId, file_id: FileId): void {
    // Add to resolutions map
    this.resolutions.set(ref_id, symbol_id)

    // Track file ownership
    if (!this.by_file.has(file_id)) {
      this.by_file.set(file_id, new Set())
    }
    this.by_file.get(file_id)!.add(ref_id)

    // Mark file as resolved (remove from pending)
    // Note: This happens incrementally as resolutions are added
    // File is fully resolved when all its references are resolved
  }

  /**
   * Mark a file's resolutions as invalid.
   * Removes cached resolutions and adds file to pending set.
   *
   * @param file_id - The file to invalidate
   */
  invalidate_file(file_id: FileId): void {
    // Remove all resolutions for this file
    const ref_ids = this.by_file.get(file_id)
    if (ref_ids) {
      for (const ref_id of ref_ids) {
        this.resolutions.delete(ref_id)
      }
      this.by_file.delete(file_id)
    }

    // Mark file as pending
    this.pending.add(file_id)
  }

  /**
   * Check if a file has valid cached resolutions.
   * Returns false if file is in pending set.
   *
   * @param file_id - The file to check
   * @returns True if file has valid cached resolutions
   */
  is_file_resolved(file_id: FileId): boolean {
    return !this.pending.has(file_id)
  }

  /**
   * Mark a file as resolved (remove from pending).
   * Called after all references in a file have been resolved.
   *
   * @param file_id - The file to mark as resolved
   */
  mark_file_resolved(file_id: FileId): void {
    this.pending.delete(file_id)
  }

  /**
   * Get all files with pending resolutions.
   *
   * @returns Set of file IDs that need re-resolution
   */
  get_pending_files(): Set<FileId> {
    return new Set(this.pending)
  }

  /**
   * Get all resolutions for a file.
   *
   * @param file_id - The file to query
   * @returns Map of reference → symbol resolutions for this file
   */
  get_file_resolutions(file_id: FileId): Map<ReferenceId, SymbolId> {
    const ref_ids = this.by_file.get(file_id)
    if (!ref_ids) {
      return new Map()
    }

    const file_resolutions = new Map<ReferenceId, SymbolId>()
    for (const ref_id of ref_ids) {
      const symbol_id = this.resolutions.get(ref_id)
      if (symbol_id) {
        file_resolutions.set(ref_id, symbol_id)
      }
    }

    return file_resolutions
  }

  /**
   * Get the total number of cached resolutions.
   *
   * @returns Count of resolutions
   */
  size(): number {
    return this.resolutions.size
  }

  /**
   * Get cache statistics.
   *
   * @returns Statistics about the cache
   */
  get_stats(): {
    total_resolutions: number
    files_with_resolutions: number
    pending_files: number
  } {
    return {
      total_resolutions: this.resolutions.size,
      files_with_resolutions: this.by_file.size,
      pending_files: this.pending.size
    }
  }

  /**
   * Check if a reference has been resolved.
   *
   * @param ref_id - The reference to check
   * @returns True if the reference has a cached resolution
   */
  has_resolution(ref_id: ReferenceId): boolean {
    return this.resolutions.has(ref_id)
  }

  /**
   * Remove all resolutions for a file.
   * Does NOT mark as pending (use for complete file removal).
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    // Remove all resolutions for this file
    const ref_ids = this.by_file.get(file_id)
    if (ref_ids) {
      for (const ref_id of ref_ids) {
        this.resolutions.delete(ref_id)
      }
      this.by_file.delete(file_id)
    }

    // Remove from pending (file is gone entirely)
    this.pending.delete(file_id)
  }

  /**
   * Clear all resolutions and pending state.
   */
  clear(): void {
    this.resolutions.clear()
    this.by_file.clear()
    this.pending.clear()
  }
}
```

### Step 2: Ensure ReferenceId Type Exists

**File**: Check `packages/types/src/index.ts`

```typescript
/** Unique identifier for a reference (reference to a symbol) */
export type ReferenceId = string & { __brand: 'ReferenceId' }

export function reference_id(name: string, file: FileId, location: Location): ReferenceId {
  return `ref:${file}:${location.line}:${location.column}:${name}` as ReferenceId
}
```

### Step 3: Create Comprehensive Unit Tests

**File**: `packages/core/src/project/resolution_cache.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ResolutionCache } from './resolution_cache'
import { file_id, function_symbol, reference_id } from '@ariadnejs/types'

describe('ResolutionCache', () => {
  let cache: ResolutionCache

  beforeEach(() => {
    cache = new ResolutionCache()
  })

  describe('set and get', () => {
    it('should cache and retrieve resolutions', () => {
      const file1 = file_id('file1.ts')
      const ref_id = reference_id('foo', file1, { line: 5, column: 10 })
      const symbol_id = function_symbol('foo', file1, { line: 1, column: 0 })

      cache.set(ref_id, symbol_id, file1)

      expect(cache.get(ref_id)).toBe(symbol_id)
    })

    it('should return undefined for unknown reference', () => {
      const ref_id = reference_id('unknown', 'test.ts', { line: 1, column: 0 })
      expect(cache.get(ref_id)).toBeUndefined()
    })
  })

  describe('invalidate_file', () => {
    it('should remove all resolutions for a file', () => {
      const file1 = file_id('file1.ts')
      const ref1 = reference_id('foo', file1, { line: 5, column: 10 })
      const ref2 = reference_id('bar', file1, { line: 6, column: 10 })
      const symbol1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const symbol2 = function_symbol('bar', file1, { line: 2, column: 0 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file1)

      expect(cache.size()).toBe(2)

      cache.invalidate_file(file1)

      expect(cache.size()).toBe(0)
      expect(cache.get(ref1)).toBeUndefined()
      expect(cache.get(ref2)).toBeUndefined()
    })

    it('should mark file as pending', () => {
      const file1 = file_id('file1.ts')
      const ref_id = reference_id('foo', file1, { line: 5, column: 10 })
      const symbol_id = function_symbol('foo', file1, { line: 1, column: 0 })

      cache.set(ref_id, symbol_id, file1)
      cache.mark_file_resolved(file1)

      expect(cache.is_file_resolved(file1)).toBe(true)

      cache.invalidate_file(file1)

      expect(cache.is_file_resolved(file1)).toBe(false)
      expect(cache.get_pending_files().has(file1)).toBe(true)
    })

    it('should not affect other files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const ref1 = reference_id('foo', file1, { line: 5, column: 10 })
      const ref2 = reference_id('bar', file2, { line: 5, column: 10 })
      const symbol1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const symbol2 = function_symbol('bar', file2, { line: 1, column: 0 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file2)

      cache.invalidate_file(file1)

      expect(cache.get(ref1)).toBeUndefined()
      expect(cache.get(ref2)).toBe(symbol2)
    })
  })

  describe('is_file_resolved', () => {
    it('should return false for files in pending set', () => {
      const file1 = file_id('file1.ts')

      cache.invalidate_file(file1)

      expect(cache.is_file_resolved(file1)).toBe(false)
    })

    it('should return true after marking file as resolved', () => {
      const file1 = file_id('file1.ts')

      cache.invalidate_file(file1)
      expect(cache.is_file_resolved(file1)).toBe(false)

      cache.mark_file_resolved(file1)
      expect(cache.is_file_resolved(file1)).toBe(true)
    })

    it('should return true for files never invalidated', () => {
      const file1 = file_id('file1.ts')
      expect(cache.is_file_resolved(file1)).toBe(true)
    })
  })

  describe('get_pending_files', () => {
    it('should return all pending files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      cache.invalidate_file(file1)
      cache.invalidate_file(file2)

      const pending = cache.get_pending_files()
      expect(pending.size).toBe(2)
      expect(pending.has(file1)).toBe(true)
      expect(pending.has(file2)).toBe(true)
    })

    it('should return empty set when no files pending', () => {
      expect(cache.get_pending_files().size).toBe(0)
    })
  })

  describe('get_file_resolutions', () => {
    it('should return all resolutions for a file', () => {
      const file1 = file_id('file1.ts')
      const ref1 = reference_id('foo', file1, { line: 5, column: 10 })
      const ref2 = reference_id('bar', file1, { line: 6, column: 10 })
      const symbol1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const symbol2 = function_symbol('bar', file1, { line: 2, column: 0 })

      cache.set(ref1, symbol1, file1)
      cache.set(ref2, symbol2, file1)

      const resolutions = cache.get_file_resolutions(file1)
      expect(resolutions.size).toBe(2)
      expect(resolutions.get(ref1)).toBe(symbol1)
      expect(resolutions.get(ref2)).toBe(symbol2)
    })

    it('should return empty map for unknown file', () => {
      const unknown_file = file_id('unknown.ts')
      expect(cache.get_file_resolutions(unknown_file).size).toBe(0)
    })
  })

  describe('remove_file', () => {
    it('should remove all resolutions and pending state', () => {
      const file1 = file_id('file1.ts')
      const ref_id = reference_id('foo', file1, { line: 5, column: 10 })
      const symbol_id = function_symbol('foo', file1, { line: 1, column: 0 })

      cache.set(ref_id, symbol_id, file1)
      cache.invalidate_file(file1)

      expect(cache.get_pending_files().has(file1)).toBe(true)

      cache.remove_file(file1)

      expect(cache.size()).toBe(0)
      expect(cache.get_pending_files().has(file1)).toBe(false)
      expect(cache.is_file_resolved(file1)).toBe(true)  // No longer pending
    })
  })

  describe('get_stats', () => {
    it('should return accurate statistics', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      cache.set(
        reference_id('foo', file1, { line: 5, column: 10 }),
        function_symbol('foo', file1, { line: 1, column: 0 }),
        file1
      )

      cache.set(
        reference_id('bar', file2, { line: 5, column: 10 }),
        function_symbol('bar', file2, { line: 1, column: 0 }),
        file2
      )

      cache.invalidate_file(file2)

      const stats = cache.get_stats()
      expect(stats.total_resolutions).toBe(1)  // file2 invalidated
      expect(stats.files_with_resolutions).toBe(1)
      expect(stats.pending_files).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all resolutions and pending state', () => {
      const file1 = file_id('file1.ts')
      const ref_id = reference_id('foo', file1, { line: 5, column: 10 })
      const symbol_id = function_symbol('foo', file1, { line: 1, column: 0 })

      cache.set(ref_id, symbol_id, file1)
      cache.invalidate_file(file1)

      expect(cache.size()).toBeGreaterThan(0)
      expect(cache.get_pending_files().size).toBeGreaterThan(0)

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(cache.get_pending_files().size).toBe(0)
    })
  })
})
```

### Step 4: Update project/index.ts

```typescript
export { DefinitionRegistry } from './definition_registry'
export { TypeRegistry } from './type_registry'
export { ScopeRegistry } from './scope_registry'
export { ExportRegistry } from './export_registry'
export { ImportGraph } from './import_graph'
export { ResolutionCache } from './resolution_cache'
```

## Acceptance Criteria

- [x] `ResolutionCache` class created with all methods
- [x] `set()` and `get()` cache and retrieve resolutions
- [x] `invalidate_file()` removes resolutions and marks file as pending
- [x] `is_file_resolved()` checks pending status correctly
- [x] `mark_file_resolved()` removes file from pending set
- [x] `get_pending_files()` returns all pending files
- [x] `get_file_resolutions()` returns all resolutions for a file
- [x] `remove_file()` removes resolutions and pending state
- [x] All unit tests pass
- [x] Test coverage > 95%

## Dependencies

- None (can be implemented independently)

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 2-3 hours
- Total: 4-6 hours

## Notes

- Pending set enables lazy re-resolution strategy
- Invalidation removes old resolutions to avoid stale data
- `mark_file_resolved()` should be called after all references in a file are resolved
- This cache is key to making incremental updates fast

## Implementation Notes

(To be filled in during implementation)
