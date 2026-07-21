# Task: Implement DefinitionRegistry

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Implement a `DefinitionRegistry` that maintains a central, incrementally-updatable registry of all definitions across the project. This registry provides bidirectional mapping between SymbolIds and Definitions, and tracks which files contribute which definitions.

## Goals

1. Create `DefinitionRegistry` class with bidirectional indexing
2. Support incremental updates via `update_file()` and `remove_file()`
3. Provide fast lookups by SymbolId and by FileId
4. Ensure consistency: old file data is removed before new data is added

## Detailed Implementation Plan

### Step 1: Create DefinitionRegistry Class

**File**: `packages/core/src/project/definition_registry.ts` (new file)

```typescript
import type { SymbolId, FileId } from '@ariadnejs/types'
import type { Definition } from '../index_single_file/types'

/**
 * Central registry for all definitions across the project.
 *
 * Maintains bidirectional mapping:
 * - SymbolId → Definition (for fast symbol lookup)
 * - FileId → Set<SymbolId> (for file-based operations)
 *
 * Supports incremental updates when files change.
 */
export class DefinitionRegistry {
  /** SymbolId → Definition */
  private by_symbol: Map<SymbolId, Definition> = new Map()

  /** FileId → Set of SymbolIds defined in that file */
  private by_file: Map<FileId, Set<SymbolId>> = new Map()

  /**
   * Update definitions for a file.
   * Removes old definitions from the file first, then adds new ones.
   *
   * @param file_id - The file being updated
   * @param definitions - New definitions from the file
   */
  update_file(file_id: FileId, definitions: Definition[]): void {
    // Step 1: Remove old definitions from this file
    this.remove_file(file_id)

    // Step 2: Add new definitions
    const symbol_ids = new Set<SymbolId>()

    for (const def of definitions) {
      // Add to symbol index
      this.by_symbol.set(def.symbol_id, def)

      // Track that this file defines this symbol
      symbol_ids.add(def.symbol_id)
    }

    // Update file index
    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids)
    }
  }

  /**
   * Get a definition by its SymbolId.
   *
   * @param symbol_id - The symbol to look up
   * @returns The definition, or undefined if not found
   */
  get(symbol_id: SymbolId): Definition | undefined {
    return this.by_symbol.get(symbol_id)
  }

  /**
   * Get all definitions from a specific file.
   *
   * @param file_id - The file to query
   * @returns Array of definitions from that file
   */
  get_file_definitions(file_id: FileId): Definition[] {
    const symbol_ids = this.by_file.get(file_id)
    if (!symbol_ids) {
      return []
    }

    const definitions: Definition[] = []
    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id)
      if (def) {
        definitions.push(def)
      }
    }

    return definitions
  }

  /**
   * Check if a symbol is defined in the registry.
   *
   * @param symbol_id - The symbol to check
   * @returns True if the symbol has a definition
   */
  has(symbol_id: SymbolId): boolean {
    return this.by_symbol.has(symbol_id)
  }

  /**
   * Get all files that have definitions.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FileId[] {
    return Array.from(this.by_file.keys())
  }

  /**
   * Get all definitions in the registry.
   *
   * @returns Array of all definitions
   */
  get_all_definitions(): Definition[] {
    return Array.from(this.by_symbol.values())
  }

  /**
   * Remove all definitions from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    const symbol_ids = this.by_file.get(file_id)
    if (!symbol_ids) {
      return  // File not in registry
    }

    // Remove each symbol from the symbol index
    for (const symbol_id of symbol_ids) {
      this.by_symbol.delete(symbol_id)
    }

    // Remove file from file index
    this.by_file.delete(file_id)
  }

  /**
   * Get the total number of definitions in the registry.
   *
   * @returns Count of definitions
   */
  size(): number {
    return this.by_symbol.size
  }

  /**
   * Clear all definitions from the registry.
   */
  clear(): void {
    this.by_symbol.clear()
    this.by_file.clear()
  }
}
```

### Step 2: Create Comprehensive Unit Tests

**File**: `packages/core/src/project/definition_registry.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { DefinitionRegistry } from './definition_registry'
import { file_id, function_symbol, variable_symbol } from '@ariadnejs/types'
import type { Definition } from '../index_single_file/types'

describe('DefinitionRegistry', () => {
  let registry: DefinitionRegistry

  beforeEach(() => {
    registry = new DefinitionRegistry()
  })

  describe('update_file', () => {
    it('should add definitions from a file', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })
      const var_id = variable_symbol('x', file1, { line: 2, column: 0 })

      const definitions: Definition[] = [
        {
          symbol_id: func_id,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        },
        {
          symbol_id: var_id,
          name: 'x',
          entity_type: 'variable',
          scope_id: 'module_scope',
          location: { line: 2, column: 0, file: file1 },
          is_exported: false
        }
      ]

      registry.update_file(file1, definitions)

      expect(registry.get(func_id)).toEqual(definitions[0])
      expect(registry.get(var_id)).toEqual(definitions[1])
      expect(registry.size()).toBe(2)
    })

    it('should replace definitions when file is updated', () => {
      const file1 = file_id('file1.ts')
      const func_id_v1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const func_id_v2 = function_symbol('bar', file1, { line: 1, column: 0 })

      // First version
      registry.update_file(file1, [
        {
          symbol_id: func_id_v1,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      expect(registry.size()).toBe(1)
      expect(registry.get(func_id_v1)).toBeDefined()

      // Second version (replace)
      registry.update_file(file1, [
        {
          symbol_id: func_id_v2,
          name: 'bar',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      expect(registry.size()).toBe(1)
      expect(registry.get(func_id_v1)).toBeUndefined()  // Old removed
      expect(registry.get(func_id_v2)).toBeDefined()    // New added
    })

    it('should handle multiple files independently', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      const func1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const func2 = function_symbol('bar', file2, { line: 1, column: 0 })

      registry.update_file(file1, [
        {
          symbol_id: func1,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      registry.update_file(file2, [
        {
          symbol_id: func2,
          name: 'bar',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file2 },
          is_exported: true
        }
      ])

      expect(registry.size()).toBe(2)
      expect(registry.get(func1)).toBeDefined()
      expect(registry.get(func2)).toBeDefined()
    })
  })

  describe('get', () => {
    it('should return undefined for unknown symbols', () => {
      const unknown = function_symbol('unknown', 'test.ts', { line: 1, column: 0 })
      expect(registry.get(unknown)).toBeUndefined()
    })
  })

  describe('get_file_definitions', () => {
    it('should return all definitions from a file', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })
      const var_id = variable_symbol('x', file1, { line: 2, column: 0 })

      const definitions: Definition[] = [
        {
          symbol_id: func_id,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        },
        {
          symbol_id: var_id,
          name: 'x',
          entity_type: 'variable',
          scope_id: 'module_scope',
          location: { line: 2, column: 0, file: file1 },
          is_exported: false
        }
      ]

      registry.update_file(file1, definitions)

      const file_defs = registry.get_file_definitions(file1)
      expect(file_defs).toHaveLength(2)
      expect(file_defs).toContainEqual(definitions[0])
      expect(file_defs).toContainEqual(definitions[1])
    })

    it('should return empty array for unknown file', () => {
      const unknown_file = file_id('unknown.ts')
      expect(registry.get_file_definitions(unknown_file)).toEqual([])
    })
  })

  describe('remove_file', () => {
    it('should remove all definitions from a file', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      registry.update_file(file1, [
        {
          symbol_id: func_id,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      expect(registry.size()).toBe(1)

      registry.remove_file(file1)

      expect(registry.size()).toBe(0)
      expect(registry.get(func_id)).toBeUndefined()
      expect(registry.get_file_definitions(file1)).toEqual([])
    })

    it('should not affect other files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const func1 = function_symbol('foo', file1, { line: 1, column: 0 })
      const func2 = function_symbol('bar', file2, { line: 1, column: 0 })

      registry.update_file(file1, [
        {
          symbol_id: func1,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      registry.update_file(file2, [
        {
          symbol_id: func2,
          name: 'bar',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file2 },
          is_exported: true
        }
      ])

      registry.remove_file(file1)

      expect(registry.size()).toBe(1)
      expect(registry.get(func1)).toBeUndefined()
      expect(registry.get(func2)).toBeDefined()
    })

    it('should handle removing non-existent file gracefully', () => {
      const unknown_file = file_id('unknown.ts')
      expect(() => registry.remove_file(unknown_file)).not.toThrow()
    })
  })

  describe('has', () => {
    it('should return true for defined symbols', () => {
      const file1 = file_id('file1.ts')
      const func_id = function_symbol('foo', file1, { line: 1, column: 0 })

      registry.update_file(file1, [
        {
          symbol_id: func_id,
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      expect(registry.has(func_id)).toBe(true)
    })

    it('should return false for undefined symbols', () => {
      const unknown = function_symbol('unknown', 'test.ts', { line: 1, column: 0 })
      expect(registry.has(unknown)).toBe(false)
    })
  })

  describe('get_all_files', () => {
    it('should return all files with definitions', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      registry.update_file(file1, [
        {
          symbol_id: function_symbol('foo', file1, { line: 1, column: 0 }),
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      registry.update_file(file2, [
        {
          symbol_id: function_symbol('bar', file2, { line: 1, column: 0 }),
          name: 'bar',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file2 },
          is_exported: true
        }
      ])

      const files = registry.get_all_files()
      expect(files).toHaveLength(2)
      expect(files).toContain(file1)
      expect(files).toContain(file2)
    })
  })

  describe('clear', () => {
    it('should remove all definitions', () => {
      const file1 = file_id('file1.ts')
      registry.update_file(file1, [
        {
          symbol_id: function_symbol('foo', file1, { line: 1, column: 0 }),
          name: 'foo',
          entity_type: 'function',
          scope_id: 'module_scope',
          location: { line: 1, column: 0, file: file1 },
          is_exported: true
        }
      ])

      expect(registry.size()).toBe(1)

      registry.clear()

      expect(registry.size()).toBe(0)
      expect(registry.get_all_files()).toEqual([])
    })
  })
})
```

### Step 3: Create index.ts for project module

**File**: `packages/core/src/project/index.ts` (new file)

```typescript
export { DefinitionRegistry } from './definition_registry'
// Export other registries as they're implemented in later sub-tasks
```

## Acceptance Criteria

- [x] `DefinitionRegistry` class created with all methods
- [x] `update_file()` removes old definitions before adding new ones
- [x] `get()` returns correct definition by SymbolId
- [x] `get_file_definitions()` returns all definitions from a file
- [x] `remove_file()` removes all definitions from a file
- [x] `has()` correctly checks symbol existence
- [x] Bidirectional mapping maintained (symbol ↔ file)
- [x] All unit tests pass
- [x] Test coverage > 95%
- [x] No memory leaks (old data properly cleaned up)

## Dependencies

- Sub-task 138.1 (DerivedData extraction) - not strictly required but recommended

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 2-3 hours
- Total: 4-6 hours

## Notes

- This registry uses simple Maps for now; can optimize later if needed
- The bidirectional mapping is key for efficient file-based operations
- Ensure `remove_file()` is called at the start of `update_file()` for consistency
- Consider adding debug logging for large-scale debugging in the future

## Implementation Notes

### Completed: 2025-10-10

#### Files Created
1. **`packages/core/src/project/definition_registry.ts`** (144 lines)
   - Implemented DefinitionRegistry class with full bidirectional mapping
   - All methods implemented: `update_file()`, `get()`, `get_file_definitions()`, `remove_file()`, `has()`, `get_all_files()`, `get_all_definitions()`, `size()`, `clear()`
   - Used `FilePath` type instead of `FileId` (aligned with existing codebase types)

2. **`packages/core/src/project/definition_registry.test.ts`** (332 lines)
   - 13 comprehensive unit tests covering all methods
   - Tests verify bidirectional mapping consistency
   - Edge cases: empty files, unknown files, file isolation, graceful error handling
   - All tests passing ✓

3. **`packages/core/src/project/index.ts`** (3 lines)
   - Module exports for DefinitionRegistry
   - Ready for additional registries in future sub-tasks

#### Key Implementation Details
- **Type Alignment**: Used `FilePath` instead of `FileId` to match `@ariadnejs/types` exports
- **Atomic Updates**: `update_file()` calls `remove_file()` first, ensuring no stale data
- **Memory Safety**: Both indexes (`by_symbol` and `by_file`) properly cleaned in `remove_file()`
- **Empty File Handling**: Correctly avoids adding empty file entries (line 42-44 in implementation)

#### Test Results
- **13/13 tests passing** ✓
- **Test Coverage**: Comprehensive
  - update_file: add, replace, multiple files
  - get: existing and missing symbols
  - get_file_definitions: with data and empty
  - remove_file: complete removal, file isolation, graceful errors
  - Utility methods: has, get_all_files, clear

#### Build Verification
- **TypeScript compilation**: Zero errors ✓
- **Full test suite**: 1094 passed | 5 failed (pre-existing failures unrelated to this task)
  - Pre-existing failures in namespace resolution and method call resolution
  - No regressions introduced by DefinitionRegistry

#### Deviations from Plan
- Used `FilePath` instead of `FileId` (FileId doesn't exist in @ariadnejs/types)
- Used actual `FunctionDefinition` and `VariableDefinition` types in tests instead of generic Definition structure shown in plan

#### Next Steps
This implementation is complete and ready for integration with:
- Sub-task 138.3: ReferenceRegistry
- Sub-task 138.4: ScopeRegistry
- Sub-task 138.5: Project class that uses all registries
