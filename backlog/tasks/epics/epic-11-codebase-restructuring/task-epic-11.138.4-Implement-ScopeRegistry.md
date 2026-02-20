# Task: Implement ScopeRegistry

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Implement a `ScopeRegistry` that maintains scope trees from all files and provides scope-based queries. This registry enables lexical scope resolution by providing access to scope chains and scope lookups.

## Goals

1. Store scope trees per file with root scope tracking
2. Provide flattened scope lookup by ScopeId across all files
3. Implement `get_enclosing_scopes()` for lexical scope chain queries
4. Support incremental updates and file removal

## Detailed Implementation Plan

### Step 1: Create ScopeRegistry Class

**File**: `packages/core/src/project/scope_registry.ts` (new file)

```typescript
import type { FileId, ScopeId, Location } from '@ariadnejs/types'
import type { Scope } from '../index_single_file/types'

/**
 * Registry for scope trees and scope-based queries.
 *
 * Each file has a scope tree (with a root module/file scope).
 * This registry aggregates scope trees from all files and provides:
 * - Scope lookup by ScopeId
 * - Scope chain queries (for lexical scope resolution)
 * - File-based scope queries
 */
export class ScopeRegistry {
  /** File → root scope of that file */
  private scope_trees: Map<FileId, Scope> = new Map()

  /** Flattened scope lookup by ScopeId (across all files) */
  private by_scope_id: Map<ScopeId, Scope> = new Map()

  /**
   * Update scope tree for a file.
   * Expects scopes array where first element is the root scope.
   *
   * @param file_id - The file being updated
   * @param scopes - Array of scopes (first = root)
   */
  update_file(file_id: FileId, scopes: Scope[]): void {
    // Remove old scopes from this file
    this.remove_file(file_id)

    if (scopes.length === 0) {
      return  // No scopes to add
    }

    // Build scope tree
    const root_scope = this.build_scope_tree(scopes)

    // Store root scope for the file
    this.scope_trees.set(file_id, root_scope)

    // Flatten and index all scopes by ScopeId
    this.index_scopes_recursively(root_scope)
  }

  /**
   * Build a hierarchical scope tree from a flat array of scopes.
   * Assumes scopes have parent_scope_id references.
   *
   * @param scopes - Flat array of scopes
   * @returns Root scope with children attached
   */
  private build_scope_tree(scopes: Scope[]): Scope {
    // Create a map for quick lookup
    const scope_map = new Map<ScopeId, Scope>()

    // Clone scopes to avoid mutating originals
    const cloned_scopes = scopes.map(s => ({ ...s, children: [] }))

    for (const scope of cloned_scopes) {
      scope_map.set(scope.scope_id, scope)
    }

    // Find root (scope with no parent or parent_scope_id === null)
    let root: Scope | undefined

    for (const scope of cloned_scopes) {
      if (!scope.parent_scope_id) {
        root = scope
      } else {
        // Attach to parent
        const parent = scope_map.get(scope.parent_scope_id)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(scope)
        }
      }
    }

    if (!root) {
      // Fallback: use first scope as root
      root = cloned_scopes[0]
    }

    return root
  }

  /**
   * Recursively index all scopes in a tree.
   *
   * @param scope - Root of scope tree to index
   */
  private index_scopes_recursively(scope: Scope): void {
    this.by_scope_id.set(scope.scope_id, scope)

    if (scope.children) {
      for (const child of scope.children) {
        this.index_scopes_recursively(child)
      }
    }
  }

  /**
   * Get the scope chain from a location (innermost to outermost).
   * Returns scopes in order: [innermost, ..., outermost (module scope)].
   *
   * @param file_id - The file containing the location
   * @param location - The location to query
   * @returns Array of scopes from innermost to outermost
   */
  get_enclosing_scopes(file_id: FileId, location: Location): Scope[] {
    const root = this.scope_trees.get(file_id)
    if (!root) {
      return []
    }

    // Find the innermost scope containing the location
    const innermost = this.find_innermost_scope(root, location)
    if (!innermost) {
      return []
    }

    // Build scope chain from innermost to outermost
    const chain: Scope[] = []
    let current: Scope | undefined = innermost

    while (current) {
      chain.push(current)

      // Move to parent
      if (current.parent_scope_id) {
        current = this.by_scope_id.get(current.parent_scope_id)
      } else {
        current = undefined
      }
    }

    return chain
  }

  /**
   * Find the innermost scope that contains a location.
   * Uses recursive depth-first search.
   *
   * @param scope - Scope to search
   * @param location - Location to find
   * @returns Innermost scope, or undefined if not found
   */
  private find_innermost_scope(scope: Scope, location: Location): Scope | undefined {
    // Check if location is within this scope
    if (!this.scope_contains_location(scope, location)) {
      return undefined
    }

    // Check children (depth-first)
    if (scope.children) {
      for (const child of scope.children) {
        const result = this.find_innermost_scope(child, location)
        if (result) {
          return result  // Found in child
        }
      }
    }

    // No child contains it, so this scope is the innermost
    return scope
  }

  /**
   * Check if a scope contains a location.
   *
   * @param scope - The scope to check
   * @param location - The location to test
   * @returns True if scope contains the location
   */
  private scope_contains_location(scope: Scope, location: Location): boolean {
    const start = scope.start
    const end = scope.end

    // Simple line-based containment check
    if (location.line < start.line || location.line > end.line) {
      return false
    }

    // If on start line, check column
    if (location.line === start.line && location.column < start.column) {
      return false
    }

    // If on end line, check column
    if (location.line === end.line && location.column > end.column) {
      return false
    }

    return true
  }

  /**
   * Get scope by ID.
   *
   * @param scope_id - The scope to look up
   * @returns The scope, or undefined if not found
   */
  get_scope(scope_id: ScopeId): Scope | undefined {
    return this.by_scope_id.get(scope_id)
  }

  /**
   * Get root scope for a file.
   *
   * @param file_id - The file to query
   * @returns Root scope, or undefined if file not indexed
   */
  get_file_root_scope(file_id: FileId): Scope | undefined {
    return this.scope_trees.get(file_id)
  }

  /**
   * Get all files with scope trees.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FileId[] {
    return Array.from(this.scope_trees.keys())
  }

  /**
   * Remove all scopes from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    const root = this.scope_trees.get(file_id)
    if (!root) {
      return
    }

    // Remove all scopes from flattened index
    this.remove_scopes_recursively(root)

    // Remove file from trees
    this.scope_trees.delete(file_id)
  }

  /**
   * Recursively remove scopes from the flattened index.
   *
   * @param scope - Root of scope tree to remove
   */
  private remove_scopes_recursively(scope: Scope): void {
    this.by_scope_id.delete(scope.scope_id)

    if (scope.children) {
      for (const child of scope.children) {
        this.remove_scopes_recursively(child)
      }
    }
  }

  /**
   * Get the total number of scopes indexed.
   *
   * @returns Count of scopes
   */
  size(): number {
    return this.by_scope_id.size
  }

  /**
   * Clear all scopes from the registry.
   */
  clear(): void {
    this.scope_trees.clear()
    this.by_scope_id.clear()
  }
}
```

### Step 2: Ensure Scope Type Has Required Fields

**File**: Check `packages/core/src/index_single_file/types.ts` for Scope definition

```typescript
export interface Scope {
  scope_id: ScopeId
  scope_type: 'module' | 'function' | 'block' | 'class' | 'method' | string
  parent_scope_id?: ScopeId
  start: Location
  end: Location
  children?: Scope[]
}
```

### Step 3: Create Comprehensive Unit Tests

**File**: `packages/core/src/project/scope_registry.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ScopeRegistry } from './scope_registry'
import { file_id } from '@ariadnejs/types'
import type { Scope } from '../index_single_file/types'

describe('ScopeRegistry', () => {
  let registry: ScopeRegistry

  beforeEach(() => {
    registry = new ScopeRegistry()
  })

  describe('update_file', () => {
    it('should store scope tree for a file', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)

      const root = registry.get_file_root_scope(file1)
      expect(root).toBeDefined()
      expect(root!.scope_id).toBe('module_scope')
    })

    it('should build hierarchical scope tree', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        },
        {
          scope_id: 'function_scope',
          scope_type: 'function',
          parent_scope_id: 'module_scope',
          start: { line: 2, column: 0, file: file1 },
          end: { line: 5, column: 0, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)

      const root = registry.get_file_root_scope(file1)
      expect(root!.children).toHaveLength(1)
      expect(root!.children![0].scope_id).toBe('function_scope')
    })
  })

  describe('get_scope', () => {
    it('should retrieve scope by ID', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)

      const scope = registry.get_scope('module_scope')
      expect(scope).toBeDefined()
      expect(scope!.scope_type).toBe('module')
    })
  })

  describe('get_enclosing_scopes', () => {
    it('should return scope chain from innermost to outermost', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        },
        {
          scope_id: 'function_scope',
          scope_type: 'function',
          parent_scope_id: 'module_scope',
          start: { line: 2, column: 0, file: file1 },
          end: { line: 5, column: 0, file: file1 }
        },
        {
          scope_id: 'block_scope',
          scope_type: 'block',
          parent_scope_id: 'function_scope',
          start: { line: 3, column: 2, file: file1 },
          end: { line: 4, column: 2, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)

      // Location inside block scope
      const location = { line: 3, column: 4, file: file1 }
      const chain = registry.get_enclosing_scopes(file1, location)

      expect(chain).toHaveLength(3)
      expect(chain[0].scope_id).toBe('block_scope')
      expect(chain[1].scope_id).toBe('function_scope')
      expect(chain[2].scope_id).toBe('module_scope')
    })

    it('should return empty array for location outside all scopes', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)

      // Location way outside
      const location = { line: 100, column: 0, file: file1 }
      const chain = registry.get_enclosing_scopes(file1, location)

      expect(chain).toEqual([])
    })
  })

  describe('remove_file', () => {
    it('should remove all scopes from a file', () => {
      const file1 = file_id('file1.ts')

      const scopes: Scope[] = [
        {
          scope_id: 'module_scope',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        }
      ]

      registry.update_file(file1, scopes)
      expect(registry.size()).toBe(1)

      registry.remove_file(file1)

      expect(registry.size()).toBe(0)
      expect(registry.get_scope('module_scope')).toBeUndefined()
      expect(registry.get_file_root_scope(file1)).toBeUndefined()
    })

    it('should not affect other files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      registry.update_file(file1, [
        {
          scope_id: 'scope1',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file1 },
          end: { line: 10, column: 0, file: file1 }
        }
      ])

      registry.update_file(file2, [
        {
          scope_id: 'scope2',
          scope_type: 'module',
          start: { line: 0, column: 0, file: file2 },
          end: { line: 10, column: 0, file: file2 }
        }
      ])

      registry.remove_file(file1)

      expect(registry.size()).toBe(1)
      expect(registry.get_scope('scope1')).toBeUndefined()
      expect(registry.get_scope('scope2')).toBeDefined()
    })
  })
})
```

### Step 4: Update project/index.ts

```typescript
export { DefinitionRegistry } from './definition_registry'
export { TypeRegistry } from './type_registry'
export { ScopeRegistry } from './scope_registry'
```

## Acceptance Criteria

- [x] `ScopeRegistry` class created with all methods
- [x] `update_file()` builds hierarchical scope tree
- [x] `get_scope()` retrieves scope by ID
- [x] `get_enclosing_scopes()` returns scope chain (innermost to outermost)
- [x] `get_file_root_scope()` returns root scope for a file
- [x] `remove_file()` removes all scopes from a file
- [x] Scope containment logic correctly handles line/column boundaries
- [x] All unit tests pass
- [x] Test coverage > 95%

## Dependencies

- None (can be implemented independently)

## Estimated Effort

- Implementation: 3-4 hours
- Testing: 2-3 hours
- Total: 5-7 hours

## Notes

- Scope trees are hierarchical; registry maintains both tree and flattened views
- `get_enclosing_scopes()` is critical for lexical scope resolution
- Containment logic assumes line/column-based boundaries
- Consider edge cases: scopes on same line, empty scopes, etc.

## Implementation Notes

### Completed Implementation (2025-10-10)

**Key Decisions:**
1. Used existing `LexicalScope` type from `@ariadnejs/types` instead of creating a new Scope interface
   - `LexicalScope` has: `id`, `parent_id`, `name`, `type`, `location`, `child_ids`
   - This aligns with the existing codebase architecture

2. Modified `update_file()` signature to accept `ReadonlyMap<ScopeId, LexicalScope>` instead of array
   - This matches how scopes are stored in `SemanticIndex` (as a Map)
   - More efficient for lookups and avoids unnecessary tree building

3. Scope containment logic uses `start_line`/`start_column`/`end_line`/`end_column` from Location
   - Inclusive boundaries on both start and end
   - Simple line/column-based comparison

**Files Created:**
- `/packages/core/src/project/scope_registry.ts` - Main implementation (246 lines)
- `/packages/core/src/project/scope_registry.test.ts` - Comprehensive tests (17 test cases)

**Test Coverage:**
- All 17 tests passing
- Coverage includes:
  - Basic CRUD operations (update, get, remove)
  - Nested scope hierarchies (3 levels deep)
  - Scope chain resolution (innermost to outermost)
  - Edge cases (boundaries, non-existent files, empty scopes)
  - Multi-file scenarios

**Integration:**
- Exported from `/packages/core/src/project/index.ts`
- Ready to be integrated with Project Coordination Layer

### Type Safety Fixes (2025-10-10)

**Issues Found During TypeScript Compilation:**
1. **Missing Type Import** - `FileId` doesn't exist in `@ariadnejs/types`
   - **Fix:** Changed all `FileId` → `FilePath` throughout implementation
   - Updated: import statement, class fields, all method signatures (6 methods)

2. **Type Safety Issue** - `root_scope` could be `undefined` after fallback
   - **Fix:** Added explicit type guard with error throwing
   - Added validation: `if (!root_scope) throw new Error(...)`

**Verification Results:**
- ✅ TypeScript compilation: **ZERO ERRORS** (`tsc --noEmit`)
- ✅ ScopeRegistry tests: **17/17 PASSED**
- ✅ Full test suite: **1,139/1,144 PASSED** (5 pre-existing failures unrelated to ScopeRegistry)

**Pre-existing Test Failures (NOT caused by ScopeRegistry):**
- 3 failures in `namespace_resolution.test.ts` - namespace member resolution issues
- 2 failures in `symbol_resolution.javascript.test.ts` - method call resolution issues
- All failures are in higher-level symbol resolution logic, not scope management
