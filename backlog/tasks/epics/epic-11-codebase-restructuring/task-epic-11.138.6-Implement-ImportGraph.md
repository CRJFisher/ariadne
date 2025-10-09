# Task: Implement ImportGraph

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: High
**Complexity**: Medium-High

## Overview

Implement an `ImportGraph` that maintains a bidirectional graph of import dependencies. This graph tracks both "what files does X import from" (dependencies) and "what files import from X" (dependents), enabling precise invalidation when files change.

## Goals

1. Track bidirectional import relationships (dependencies + dependents)
2. Support incremental updates with correct dependency cleanup
3. Provide transitive dependency queries
4. Enable precise invalidation: when file X changes, invalidate its dependents

## Detailed Implementation Plan

### Step 1: Create ImportGraph Class

**File**: `packages/core/src/project/import_graph.ts` (new file)

```typescript
import type { FileId } from '@ariadnejs/types'
import type { Import } from '../index_single_file/types'

/**
 * Bidirectional import dependency graph.
 *
 * Tracks two relationships:
 * 1. Dependencies: File A imports from File B
 * 2. Dependents: File B is imported by File A
 *
 * This enables:
 * - Knowing what files to invalidate when a file changes (dependents)
 * - Knowing what files are needed to resolve a file (dependencies)
 * - Transitive dependency queries (for bundling, etc.)
 */
export class ImportGraph {
  /** File → Files that this file imports from */
  private dependencies: Map<FileId, Set<FileId>> = new Map()

  /** File → Files that import from this file */
  private dependents: Map<FileId, Set<FileId>> = new Map()

  /**
   * Update import relationships for a file.
   * Removes old relationships, establishes new ones.
   *
   * @param file_id - The file being updated
   * @param imports - Import statements from the file
   */
  update_file(file_id: FileId, imports: Import[]): void {
    // Step 1: Remove old relationships for this file
    this.remove_file(file_id)

    // Step 2: Extract target files from imports
    const target_files = new Set<FileId>()
    for (const imp of imports) {
      // Assume Import has a `source_file` field pointing to the imported file
      if (imp.source_file) {
        target_files.add(imp.source_file)
      }
    }

    if (target_files.size === 0) {
      return  // No imports
    }

    // Step 3: Add dependencies (file_id → targets)
    this.dependencies.set(file_id, target_files)

    // Step 4: Add reverse relationships (targets → file_id as dependent)
    for (const target of target_files) {
      if (!this.dependents.has(target)) {
        this.dependents.set(target, new Set())
      }
      this.dependents.get(target)!.add(file_id)
    }
  }

  /**
   * Get files that this file imports from (direct dependencies).
   *
   * @param file_id - The file to query
   * @returns Set of files that this file imports from
   */
  get_dependencies(file_id: FileId): Set<FileId> {
    const deps = this.dependencies.get(file_id)
    return deps ? new Set(deps) : new Set()
  }

  /**
   * Get files that import from this file (direct dependents).
   * These are the files that need invalidation when this file changes.
   *
   * @param file_id - The file to query
   * @returns Set of files that import from this file
   */
  get_dependents(file_id: FileId): Set<FileId> {
    const deps = this.dependents.get(file_id)
    return deps ? new Set(deps) : new Set()
  }

  /**
   * Get all files reachable from this file (transitive dependencies).
   * Uses depth-first search, detects cycles.
   *
   * @param file_id - The file to start from
   * @returns Set of all transitively reachable files
   */
  get_transitive_dependencies(file_id: FileId): Set<FileId> {
    const visited = new Set<FileId>()
    const stack = [file_id]

    while (stack.length > 0) {
      const current = stack.pop()!

      if (visited.has(current)) {
        continue  // Already visited (cycle or duplicate)
      }

      visited.add(current)

      // Add direct dependencies to stack
      const deps = this.dependencies.get(current)
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep)
          }
        }
      }
    }

    // Remove the starting file from results
    visited.delete(file_id)

    return visited
  }

  /**
   * Get all files that transitively depend on this file.
   * If this file changes, all of these may need re-resolution.
   *
   * @param file_id - The file to query
   * @returns Set of all files transitively depending on this file
   */
  get_transitive_dependents(file_id: FileId): Set<FileId> {
    const visited = new Set<FileId>()
    const stack = [file_id]

    while (stack.length > 0) {
      const current = stack.pop()!

      if (visited.has(current)) {
        continue
      }

      visited.add(current)

      // Add direct dependents to stack
      const deps = this.dependents.get(current)
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep)
          }
        }
      }
    }

    // Remove the starting file from results
    visited.delete(file_id)

    return visited
  }

  /**
   * Check if file A imports from file B (directly).
   *
   * @param importer - The importing file
   * @param imported - The file being imported
   * @returns True if importer directly imports from imported
   */
  has_dependency(importer: FileId, imported: FileId): boolean {
    const deps = this.dependencies.get(importer)
    return deps ? deps.has(imported) : false
  }

  /**
   * Detect import cycles involving a file.
   *
   * @param file_id - The file to check
   * @returns Array of files forming a cycle, or empty if no cycle
   */
  detect_cycle(file_id: FileId): FileId[] {
    const visited = new Set<FileId>()
    const path: FileId[] = []

    const has_cycle = (current: FileId): boolean => {
      if (path.includes(current)) {
        // Found cycle - return the cycle portion
        return true
      }

      if (visited.has(current)) {
        return false  // Already explored, no cycle
      }

      visited.add(current)
      path.push(current)

      const deps = this.dependencies.get(current)
      if (deps) {
        for (const dep of deps) {
          if (has_cycle(dep)) {
            return true
          }
        }
      }

      path.pop()
      return false
    }

    if (has_cycle(file_id)) {
      // Extract cycle from path
      const cycle_start = path.indexOf(path[path.length - 1])
      return path.slice(cycle_start)
    }

    return []
  }

  /**
   * Get all files in the graph.
   *
   * @returns Set of all file IDs
   */
  get_all_files(): Set<FileId> {
    const files = new Set<FileId>()

    for (const file of this.dependencies.keys()) {
      files.add(file)
    }

    for (const file of this.dependents.keys()) {
      files.add(file)
    }

    return files
  }

  /**
   * Remove all import relationships for a file.
   * Removes both outgoing (dependencies) and incoming (dependents) edges.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    // Remove outgoing edges (this file's dependencies)
    const old_deps = this.dependencies.get(file_id)
    if (old_deps) {
      for (const target of old_deps) {
        // Remove file_id from target's dependents
        const target_dependents = this.dependents.get(target)
        if (target_dependents) {
          target_dependents.delete(file_id)

          // Clean up empty sets
          if (target_dependents.size === 0) {
            this.dependents.delete(target)
          }
        }
      }

      this.dependencies.delete(file_id)
    }

    // Remove incoming edges (other files depending on this file)
    const old_dependents = this.dependents.get(file_id)
    if (old_dependents) {
      for (const source of old_dependents) {
        // Remove file_id from source's dependencies
        const source_deps = this.dependencies.get(source)
        if (source_deps) {
          source_deps.delete(file_id)

          // Clean up empty sets
          if (source_deps.size === 0) {
            this.dependencies.delete(source)
          }
        }
      }

      this.dependents.delete(file_id)
    }
  }

  /**
   * Get statistics about the graph.
   *
   * @returns Graph statistics
   */
  get_stats(): {
    file_count: number
    edge_count: number
    avg_dependencies: number
    avg_dependents: number
  } {
    const files = this.get_all_files()
    const file_count = files.size

    let edge_count = 0
    for (const deps of this.dependencies.values()) {
      edge_count += deps.size
    }

    return {
      file_count,
      edge_count,
      avg_dependencies: file_count > 0 ? edge_count / file_count : 0,
      avg_dependents: file_count > 0 ? edge_count / file_count : 0
    }
  }

  /**
   * Clear all import relationships from the graph.
   */
  clear(): void {
    this.dependencies.clear()
    this.dependents.clear()
  }
}
```

### Step 2: Ensure Import Type Exists

**File**: Check `packages/core/src/index_single_file/types.ts`

```typescript
export interface Import {
  /** The file being imported from (resolved file path) */
  source_file?: FileId

  /** Import source string (e.g., './module', '@/lib/utils') */
  source: string

  /** Imported symbols (named imports) */
  imported_symbols?: Array<{
    name: string
    alias?: string  // For 'import { foo as bar }'
  }>

  /** Is this a default import? */
  is_default_import?: boolean

  /** Is this a namespace import? (import * as name) */
  is_namespace_import?: boolean

  /** Location of import statement */
  location: Location
}
```

### Step 3: Create Comprehensive Unit Tests

**File**: `packages/core/src/project/import_graph.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ImportGraph } from './import_graph'
import { file_id } from '@ariadnejs/types'
import type { Import } from '../index_single_file/types'

describe('ImportGraph', () => {
  let graph: ImportGraph

  beforeEach(() => {
    graph = new ImportGraph()
  })

  describe('update_file', () => {
    it('should add import relationships', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      const imports: Import[] = [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ]

      graph.update_file(file1, imports)

      expect(graph.get_dependencies(file1).has(file2)).toBe(true)
      expect(graph.get_dependents(file2).has(file1)).toBe(true)
    })

    it('should handle multiple imports', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      const imports: Import[] = [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        },
        {
          source_file: file3,
          source: './file3',
          location: { line: 2, column: 0, file: file1 }
        }
      ]

      graph.update_file(file1, imports)

      const deps = graph.get_dependencies(file1)
      expect(deps.size).toBe(2)
      expect(deps.has(file2)).toBe(true)
      expect(deps.has(file3)).toBe(true)
    })

    it('should replace imports when file is updated', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      // First version: imports file2
      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      expect(graph.get_dependencies(file1).has(file2)).toBe(true)
      expect(graph.get_dependents(file2).has(file1)).toBe(true)

      // Second version: imports file3 instead
      graph.update_file(file1, [
        {
          source_file: file3,
          source: './file3',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      expect(graph.get_dependencies(file1).has(file2)).toBe(false)
      expect(graph.get_dependencies(file1).has(file3)).toBe(true)
      expect(graph.get_dependents(file2).has(file1)).toBe(false)
      expect(graph.get_dependents(file3).has(file1)).toBe(true)
    })
  })

  describe('get_transitive_dependencies', () => {
    it('should find all transitive dependencies', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      // file1 → file2 → file3
      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.update_file(file2, [
        {
          source_file: file3,
          source: './file3',
          location: { line: 1, column: 0, file: file2 }
        }
      ])

      const transitive = graph.get_transitive_dependencies(file1)
      expect(transitive.size).toBe(2)
      expect(transitive.has(file2)).toBe(true)
      expect(transitive.has(file3)).toBe(true)
    })

    it('should handle cycles gracefully', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      // file1 → file2 → file1 (cycle)
      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.update_file(file2, [
        {
          source_file: file1,
          source: './file1',
          location: { line: 1, column: 0, file: file2 }
        }
      ])

      // Should not hang
      const transitive = graph.get_transitive_dependencies(file1)
      expect(transitive.has(file2)).toBe(true)
      expect(transitive.has(file1)).toBe(false)  // Shouldn't include self
    })
  })

  describe('get_transitive_dependents', () => {
    it('should find all transitive dependents', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      // file1 → file2 → file3
      // So file3 has transitive dependents: file2, file1
      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.update_file(file2, [
        {
          source_file: file3,
          source: './file3',
          location: { line: 1, column: 0, file: file2 }
        }
      ])

      const transitive = graph.get_transitive_dependents(file3)
      expect(transitive.size).toBe(2)
      expect(transitive.has(file2)).toBe(true)
      expect(transitive.has(file1)).toBe(true)
    })
  })

  describe('detect_cycle', () => {
    it('should detect simple cycle', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      // file1 → file2 → file1
      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.update_file(file2, [
        {
          source_file: file1,
          source: './file1',
          location: { line: 1, column: 0, file: file2 }
        }
      ])

      const cycle = graph.detect_cycle(file1)
      expect(cycle.length).toBeGreaterThan(0)
    })

    it('should return empty for acyclic graph', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      const cycle = graph.detect_cycle(file1)
      expect(cycle).toEqual([])
    })
  })

  describe('remove_file', () => {
    it('should remove all relationships for a file', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')

      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.remove_file(file1)

      expect(graph.get_dependencies(file1).size).toBe(0)
      expect(graph.get_dependents(file2).size).toBe(0)
    })

    it('should not affect other files', () => {
      const file1 = file_id('file1.ts')
      const file2 = file_id('file2.ts')
      const file3 = file_id('file3.ts')

      graph.update_file(file1, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file1 }
        }
      ])

      graph.update_file(file3, [
        {
          source_file: file2,
          source: './file2',
          location: { line: 1, column: 0, file: file3 }
        }
      ])

      graph.remove_file(file1)

      // file3's relationship with file2 should remain
      expect(graph.get_dependencies(file3).has(file2)).toBe(true)
      expect(graph.get_dependents(file2).has(file3)).toBe(true)
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
```

## Acceptance Criteria

- [x] `ImportGraph` class created with bidirectional tracking
- [x] `update_file()` correctly maintains both dependencies and dependents
- [x] `get_dependencies()` and `get_dependents()` work correctly
- [x] `get_transitive_dependencies()` handles cycles gracefully
- [x] `get_transitive_dependents()` finds all affected files
- [x] `detect_cycle()` identifies import cycles
- [x] `remove_file()` cleans up both directions of relationships
- [x] All unit tests pass
- [x] Test coverage > 95%

## Dependencies

- None (can be implemented independently)

## Estimated Effort

- Implementation: 4-5 hours
- Testing: 3-4 hours
- Total: 7-9 hours

## Notes

- Bidirectional tracking is critical for efficient invalidation
- Cycle detection is important for debugging circular imports
- Transitive queries use DFS with cycle protection
- This graph will be key for determining which files to invalidate on changes

## Implementation Notes

(To be filled in during implementation)
