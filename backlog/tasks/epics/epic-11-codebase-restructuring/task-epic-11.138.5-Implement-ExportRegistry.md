# Task: Implement ExportRegistry

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: High
**Complexity**: Low

## Overview

Implement an `ExportRegistry` that tracks which symbols each file exports. This registry is used for import resolution to determine what symbols are available from a given file.

## Goals

1. Track exported symbols per file
2. Support incremental updates and file removal
3. Provide fast lookup for "does file X export symbol Y?"
4. Maintain consistency on file updates

## Detailed Implementation Plan

### Step 1: Create ExportRegistry Class

**File**: `packages/core/src/project/export_registry.ts` (new file)

```typescript
import type { FileId, SymbolId } from '@ariadnejs/types'

/**
 * Registry tracking what symbols each file exports.
 *
 * Used for import resolution: when resolving `import { foo } from './module'`,
 * we need to check if the target file exports `foo`.
 */
export class ExportRegistry {
  /** File → Set of SymbolIds that file exports */
  private exports: Map<FileId, Set<SymbolId>> = new Map()

  /**
   * Update exports for a file.
   * Replaces any existing export information for the file.
   *
   * @param file_id - The file being updated
   * @param exported - Set of SymbolIds that the file exports
   */
  update_file(file_id: FileId, exported: Set<SymbolId>): void {
    if (exported.size === 0) {
      // No exports, remove entry
      this.exports.delete(file_id)
    } else {
      // Clone the set to avoid external mutations
      this.exports.set(file_id, new Set(exported))
    }
  }

  /**
   * Get all symbols exported by a file.
   *
   * @param file_id - The file to query
   * @returns Set of exported SymbolIds (empty set if file has no exports)
   */
  get_exports(file_id: FileId): Set<SymbolId> {
    const exports = this.exports.get(file_id)
    return exports ? new Set(exports) : new Set()
  }

  /**
   * Check if a file exports a specific symbol.
   *
   * @param file_id - The file to check
   * @param symbol_id - The symbol to check
   * @returns True if the file exports the symbol
   */
  exports_symbol(file_id: FileId, symbol_id: SymbolId): boolean {
    const file_exports = this.exports.get(file_id)
    return file_exports ? file_exports.has(symbol_id) : false
  }

  /**
   * Get all files that export at least one symbol.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FileId[] {
    return Array.from(this.exports.keys())
  }

  /**
   * Get the total number of files with exports.
   *
   * @returns Count of files
   */
  get_file_count(): number {
    return this.exports.size
  }

  /**
   * Get the total number of exported symbols across all files.
   *
   * @returns Count of symbols
   */
  get_total_export_count(): number {
    let count = 0
    for (const exported_set of this.exports.values()) {
      count += exported_set.size
    }
    return count
  }

  /**
   * Find all files that export a specific symbol.
   * Useful for finding symbol conflicts or multiple providers.
   *
   * @param symbol_id - The symbol to search for
   * @returns Array of file IDs that export this symbol
   */
  find_exporters(symbol_id: SymbolId): FileId[] {
    const exporters: FileId[] = []

    for (const [file_id, exported_symbols] of this.exports) {
      if (exported_symbols.has(symbol_id)) {
        exporters.push(file_id)
      }
    }

    return exporters
  }

  /**
   * Remove all export information from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    this.exports.delete(file_id)
  }

  /**
   * Clear all export information from the registry.
   */
  clear(): void {
    this.exports.clear()
  }
}
```

### Step 2: Create Comprehensive Unit Tests

**File**: `packages/core/src/project/export_registry.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ExportRegistry } from './export_registry'
import { file_id, function_symbol, variable_symbol } from '@ariadnejs/types'

describe('ExportRegistry', () => {
  let registry: ExportRegistry

  beforeEach(() => {
    registry = new ExportRegistry()
  })

  describe('update_file', () => {
    it('should store exports for a file', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })
      const var_id = variable_symbol('x', file1, { line: 2, column: 0 })

      const exported = new Set([func_id, var_id])
      registry.update_file(file1, exported)

      const exports = registry.get_exports(file1)
      expect(exports.size).toBe(2)
      expect(exports.has(func_id)).toBe(true)
      expect(exports.has(var_id)).toBe(true)
    })

    it('should replace exports when file is updated', () => {
      const file1 = file_id('file1.ts')
      const func1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const func2 = function_symbol('bar', file1, { line: 2, column: 0 })

      // First version
      registry.update_file(file1, new Set([func1]))
      expect(registry.get_exports(file1).size).toBe(1)

      // Second version (replace)
      registry.update_file(file1, new Set([func2]))

      const exports = registry.get_exports(file1)
      expect(exports.size).toBe(1)
      expect(exports.has(func1)).toBe(false)
      expect(exports.has(func2)).toBe(true)
    })

    it('should handle empty export set', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      // First add exports
      registry.update_file(file1, new Set([func_id]))
      expect(registry.get_file_count()).toBe(1)

      // Then update with empty set
      registry.update_file(file1, new Set())

      expect(registry.get_file_count()).toBe(0)
      expect(registry.get_exports(file1).size).toBe(0)
    })
  })

  describe('get_exports', () => {
    it('should return empty set for unknown file', () => {
      const unknown_file = file_id('unknown.ts')
      expect(registry.get_exports(unknown_file).size).toBe(0)
    })

    it('should return cloned set to prevent external mutations', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      registry.update_file(file1, new Set([func_id]))

      const exports1 = registry.get_exports(file1)
      const exports2 = registry.get_exports(file1)

      // Should be equal but not same reference
      expect(exports1).toEqual(exports2)
      expect(exports1).not.toBe(exports2)

      // Mutating one should not affect the other
      exports1.add(variable_symbol('x', file1, { line: 2, column: 0 }))
      expect(exports2.size).toBe(1)  // Unchanged
    })
  })

  describe('exports_symbol', () => {
    it('should return true for exported symbols', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      registry.update_file(file1, new Set([func_id]))

      expect(registry.exports_symbol(file1, func_id)).toBe(true)
    })

    it('should return false for non-exported symbols', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })
      const other_id = function_symbol('bar', file1, { line: 2, column: 0 })

      registry.update_file(file1, new Set([func_id]))

      expect(registry.exports_symbol(file1, other_id)).toBe(false)
    })

    it('should return false for unknown file', () => {
      const unknown_file = file_id('unknown.ts')
      const func_id = function_symbol('foo', 'test.ts', { line: 1, column: 0 })

      expect(registry.exports_symbol(unknown_file, func_id)).toBe(false)
    })
  })

  describe('find_exporters', () => {
    it('should find all files that export a symbol', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      // Both files export the same symbol (e.g., re-exports)
      registry.update_file(file1, new Set([func_id]))
      registry.update_file(file2, new Set([func_id]))

      const exporters = registry.find_exporters(func_id)
      expect(exporters).toHaveLength(2)
      expect(exporters).toContain(file1)
      expect(exporters).toContain(file2)
    })

    it('should return empty array for non-exported symbol', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })
      const other_id = function_symbol('bar', file1, { line: 2, column: 0 })

      registry.update_file(file1, new Set([func_id]))

      expect(registry.find_exporters(other_id)).toEqual([])
    })
  })

  describe('get_total_export_count', () => {
    it('should count total exports across all files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      registry.update_file(file1, new Set([
        function_symbol('foo', file1, { line: 1, column: 0 }),
        function_symbol('bar', file1, { line: 2, column: 0 })
      ]))

      registry.update_file(file2, new Set([
        function_symbol('baz', file2, { line: 1, column: 0 })
      ]))

      expect(registry.get_total_export_count()).toBe(3)
    })
  })

  describe('remove_file', () => {
    it('should remove all exports from a file', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      registry.update_file(file1, new Set([func_id]))
      expect(registry.get_file_count()).toBe(1)

      registry.remove_file(file1)

      expect(registry.get_file_count()).toBe(0)
      expect(registry.get_exports(file1).size).toBe(0)
    })

    it('should not affect other files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const func1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const func2 = function_symbol('bar', file2, { line: 1, column: 0 })

      registry.update_file(file1, new Set([func1]))
      registry.update_file(file2, new Set([func2]))

      registry.remove_file(file1)

      expect(registry.get_file_count()).toBe(1)
      expect(registry.get_exports(file2).has(func2)).toBe(true)
    })

    it('should handle removing non-existent file gracefully', () => {
      const unknown_file = file_id('unknown.ts')
      expect(() => registry.remove_file(unknown_file)).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should remove all exports', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      registry.update_file(file1, new Set([function_symbol('foo', file1, { line: 1, column: 0 })]))
      registry.update_file(file2, new Set([function_symbol('bar', file2, { line: 1, column: 0 })]))

      expect(registry.get_file_count()).toBe(2)

      registry.clear()

      expect(registry.get_file_count()).toBe(0)
      expect(registry.get_total_export_count()).toBe(0)
    })
  })
})
```

### Step 3: Update project/index.ts

```typescript
export { DefinitionRegistry } from './definition_registry'
export { TypeRegistry } from './type_registry'
export { ScopeRegistry } from './scope_registry'
export { ExportRegistry } from './export_registry'
```

## Acceptance Criteria

- [x] `ExportRegistry` class created with all methods
- [x] `update_file()` stores exported symbols for a file
- [x] `get_exports()` returns cloned set (prevents external mutations)
- [x] `exports_symbol()` checks if file exports a symbol
- [x] `find_exporters()` finds all files exporting a symbol
- [x] `remove_file()` removes all exports from a file
- [x] All unit tests pass
- [x] Test coverage > 95%

## Dependencies

- None (can be implemented independently)

## Estimated Effort

- Implementation: 1-2 hours
- Testing: 1-2 hours
- Total: 2-4 hours

## Notes

- This is the simplest registry - just tracks symbol sets per file
- `find_exporters()` is useful for detecting duplicate exports or re-exports
- Cloning sets on `get_exports()` prevents accidental mutations
- This registry will be heavily used by import resolution logic

## Implementation Notes

(To be filled in during implementation)
