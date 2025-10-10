# Task: Implement Project Coordinator

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Completed
**Priority**: High
**Complexity**: High

## Overview

Implement the `Project` class that coordinates the entire processing pipeline. This class orchestrates file updates, manages all registries, handles invalidation, and provides a clean query interface for downstream consumers.

## Goals

1. Implement `Project` class with all registries
2. Implement 4-phase `update_file()` workflow
3. Implement lazy `resolve_file()` with cache checking
4. Implement `get_call_graph()` with automatic resolution
5. Provide query interface for definitions, types, resolutions, etc.

## Detailed Implementation Plan

### Step 1: Create Project Class

**File**: `packages/core/src/project/project.ts` (new file)

```typescript
import type { FileId, SymbolId, ReferenceId } from '@ariadnejs/types'
import { build_semantic_index } from '../index_single_file/semantic_index'
import { build_derived_data } from '../index_single_file/derived_data'
import type { SemanticIndex } from '../index_single_file/semantic_index'
import type { DerivedData } from '../index_single_file/derived_data'
import type { Definition } from '../index_single_file/types'
import { DefinitionRegistry } from './definition_registry'
import { TypeRegistry } from './type_registry'
import { ScopeRegistry } from './scope_registry'
import { ExportRegistry } from './export_registry'
import { ImportGraph } from './import_graph'
import { ResolutionCache } from './resolution_cache'
import { resolve_symbols } from '../resolve_references/symbol_resolution'
import { detect_call_graph, type CallGraph } from '../trace_call_graph/detect_call_graph'

/**
 * Main coordinator for the entire processing pipeline.
 *
 * Manages:
 * - File-level data (SemanticIndex, DerivedData)
 * - Project-level registries (definitions, types, scopes, exports, imports)
 * - Resolution caching with lazy re-resolution
 * - Call graph computation
 *
 * Provides incremental updates: when a file changes, only recompute
 * file-local data and invalidate affected resolutions.
 */
export class Project {
  // ===== File-level data (immutable once computed) =====
  private semantic_indexes: Map<FileId, SemanticIndex> = new Map()
  private derived_data: Map<FileId, DerivedData> = new Map()

  // ===== Project-level registries (aggregated, incrementally updated) =====
  private definitions: DefinitionRegistry = new DefinitionRegistry()
  private types: TypeRegistry = new TypeRegistry()
  private scopes: ScopeRegistry = new ScopeRegistry()
  private exports: ExportRegistry = new ExportRegistry()
  private imports: ImportGraph = new ImportGraph()

  // ===== Resolution layer (cached with invalidation) =====
  private resolutions: ResolutionCache = new ResolutionCache()
  private call_graph_cache: CallGraph | null = null

  /**
   * Add or update a file in the project.
   * This is the main entry point for incremental updates.
   *
   * Process (4 phases):
   * 0. Track dependents before updating import graph
   * 1. Compute file-local data (SemanticIndex + DerivedData)
   * 2. Update all project registries
   * 3. Invalidate affected resolutions (this file + dependents)
   *
   * @param file_id - The file to update
   * @param content - The file's source code
   */
  update_file(file_id: FileId, content: string): void {
    // Phase 0: Track who depends on this file (before updating imports)
    const dependents = this.imports.get_dependents(file_id)

    // Phase 1: Compute file-local data
    const semantic_index = build_semantic_index(file_id, content)
    const derived = build_derived_data(semantic_index)

    this.semantic_indexes.set(file_id, semantic_index)
    this.derived_data.set(file_id, derived)

    // Phase 2: Update project-level registries
    this.definitions.update_file(file_id, semantic_index.definitions)
    this.types.update_file(file_id, derived)
    this.scopes.update_file(file_id, semantic_index.scopes)
    this.exports.update_file(file_id, derived.exported_symbols)
    this.imports.update_file(file_id, semantic_index.imports)

    // Phase 3: Invalidate affected resolutions
    this.resolutions.invalidate_file(file_id)
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file)
    }
    this.call_graph_cache = null  // Invalidate call graph
  }

  /**
   * Remove a file from the project completely.
   * Removes all file-local data, registry entries, and resolutions.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FileId): void {
    const dependents = this.imports.get_dependents(file_id)

    // Remove from file-level stores
    this.semantic_indexes.delete(file_id)
    this.derived_data.delete(file_id)

    // Remove from registries
    this.definitions.remove_file(file_id)
    this.types.remove_file(file_id)
    this.scopes.remove_file(file_id)
    this.exports.remove_file(file_id)
    this.imports.remove_file(file_id)

    // Invalidate resolutions
    this.resolutions.remove_file(file_id)
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file)
    }
    this.call_graph_cache = null
  }

  /**
   * Resolve references in a specific file (lazy).
   * Only resolves if the file has invalidated resolutions.
   *
   * @param file_id - The file to resolve
   */
  resolve_file(file_id: FileId): void {
    if (this.resolutions.is_file_resolved(file_id)) {
      return  // Already resolved, use cache
    }

    const semantic_index = this.semantic_indexes.get(file_id)
    if (!semantic_index) {
      throw new Error(`Cannot resolve file ${file_id}: not indexed`)
    }

    // Call resolve_symbols with registry access
    // (Note: resolve_symbols signature will be updated in sub-task 138.9)
    const resolved = resolve_symbols(
      semantic_index,
      this.definitions,
      this.types,
      this.scopes,
      this.exports,
      this.imports
    )

    // Cache all resolutions
    for (const [ref_id, symbol_id] of resolved) {
      this.resolutions.set(ref_id, symbol_id, file_id)
    }

    // Mark file as resolved
    this.resolutions.mark_file_resolved(file_id)
  }

  /**
   * Ensure all files with pending resolutions are resolved.
   * Private helper used by get_call_graph().
   */
  private resolve_all_pending(): void {
    const pending = this.resolutions.get_pending_files()
    for (const file_id of pending) {
      this.resolve_file(file_id)
    }
  }

  /**
   * Get the call graph (builds if needed).
   * Triggers resolution of all pending files first.
   *
   * @returns The call graph
   */
  get_call_graph(): CallGraph {
    if (this.call_graph_cache) {
      return this.call_graph_cache
    }

    // Resolve all pending files
    this.resolve_all_pending()

    // Build call graph from resolutions
    this.call_graph_cache = detect_call_graph(
      this.resolutions,
      this.definitions
    )

    return this.call_graph_cache
  }

  // ===== Query Interface =====

  /**
   * Get definition by symbol ID.
   *
   * @param symbol_id - The symbol to look up
   * @returns The definition, or undefined
   */
  get_definition(symbol_id: SymbolId): Definition | undefined {
    return this.definitions.get(symbol_id)
  }

  /**
   * Resolve a specific reference.
   * Ensures the file is resolved first.
   *
   * @param ref_id - The reference to resolve
   * @param file_id - The file containing the reference
   * @returns The resolved symbol ID, or undefined
   */
  resolve_reference(ref_id: ReferenceId, file_id: FileId): SymbolId | undefined {
    this.resolve_file(file_id)  // Ensure file is resolved
    return this.resolutions.get(ref_id)
  }

  /**
   * Get all definitions in a file.
   *
   * @param file_id - The file to query
   * @returns Array of definitions
   */
  get_file_definitions(file_id: FileId): Definition[] {
    return this.definitions.get_file_definitions(file_id)
  }

  /**
   * Get type information for a symbol.
   *
   * @param symbol_id - The symbol to query
   * @returns Type info, or undefined
   */
  get_type_info(symbol_id: SymbolId): TypeInfo | undefined {
    return this.types.get_type_binding(symbol_id)
  }

  /**
   * Get files that import from this file.
   * These are the files that would be affected if this file changes.
   *
   * @param file_id - The file to query
   * @returns Set of dependent files
   */
  get_dependents(file_id: FileId): Set<FileId> {
    return this.imports.get_dependents(file_id)
  }

  /**
   * Get the semantic index for a file (raw parsing output).
   *
   * @param file_id - The file to query
   * @returns Semantic index, or undefined
   */
  get_semantic_index(file_id: FileId): SemanticIndex | undefined {
    return this.semantic_indexes.get(file_id)
  }

  /**
   * Get derived data for a file (indexed structures).
   *
   * @param file_id - The file to query
   * @returns Derived data, or undefined
   */
  get_derived_data(file_id: FileId): DerivedData | undefined {
    return this.derived_data.get(file_id)
  }

  /**
   * Get all files in the project.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FileId[] {
    return Array.from(this.semantic_indexes.keys())
  }

  /**
   * Get project statistics.
   *
   * @returns Statistics about the project
   */
  get_stats(): {
    file_count: number
    definition_count: number
    pending_resolution_count: number
    cached_resolution_count: number
  } {
    return {
      file_count: this.semantic_indexes.size,
      definition_count: this.definitions.size(),
      pending_resolution_count: this.resolutions.get_pending_files().size,
      cached_resolution_count: this.resolutions.size()
    }
  }

  /**
   * Clear all data from the project.
   */
  clear(): void {
    this.semantic_indexes.clear()
    this.derived_data.clear()
    this.definitions.clear()
    this.types.clear()
    this.scopes.clear()
    this.exports.clear()
    this.imports.clear()
    this.resolutions.clear()
    this.call_graph_cache = null
  }
}
```

### Step 2: Create Basic Unit Tests

**File**: `packages/core/src/project/project.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Project } from './project'
import { file_id } from '@ariadnejs/types'

describe('Project', () => {
  let project: Project

  beforeEach(() => {
    project = new Project()
  })

  describe('update_file', () => {
    it('should index a simple TypeScript file', () => {
      const file1 = file_id('file1.ts')
      const code = `
        function foo() {
          return 42
        }
      `

      project.update_file(file1, code)

      const defs = project.get_file_definitions(file1)
      expect(defs.length).toBeGreaterThan(0)

      const foo_def = defs.find(d => d.name === 'foo')
      expect(foo_def).toBeDefined()
      expect(foo_def!.entity_type).toBe('function')
    })

    it('should update file when content changes', () => {
      const file1 = file_id('file1.ts')

      // First version
      project.update_file(file1, 'function foo() {}')
      expect(project.get_file_definitions(file1).length).toBe(1)

      // Second version
      project.update_file(file1, 'function foo() {}\nfunction bar() {}')
      expect(project.get_file_definitions(file1).length).toBe(2)
    })
  })

  describe('remove_file', () => {
    it('should remove all data for a file', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, 'function foo() {}')

      expect(project.get_file_definitions(file1).length).toBe(1)

      project.remove_file(file1)

      expect(project.get_file_definitions(file1).length).toBe(0)
      expect(project.get_all_files()).not.toContain(file1)
    })
  })

  describe('get_stats', () => {
    it('should return accurate statistics', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, 'function foo() {}')

      const stats = project.get_stats()
      expect(stats.file_count).toBe(1)
      expect(stats.definition_count).toBeGreaterThan(0)
    })
  })

  describe('clear', () => {
    it('should remove all data', () => {
      const file1 = file_id('file1.ts')
      project.update_file(file1, 'function foo() {}')

      expect(project.get_stats().file_count).toBe(1)

      project.clear()

      expect(project.get_stats().file_count).toBe(0)
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
export { ImportGraph } from './import_graph'
export { ResolutionCache } from './resolution_cache'
export { Project } from './project'
```

### Step 4: Update packages/core/src/index.ts

Add Project to the main export:

```typescript
export { Project } from './project'
export { build_semantic_index } from './index_single_file/semantic_index'
export { resolve_symbols } from './resolve_references/symbol_resolution'
export { detect_call_graph } from './trace_call_graph/detect_call_graph'
// ... other exports
```

## Acceptance Criteria

- [x] `Project` class created with all registries ✓
- [x] `update_file()` implements 4-phase workflow correctly ✓
- [x] `remove_file()` removes all data and invalidates dependents ✓
- [x] `resolve_file()` uses lazy resolution (checks cache first) ✓
- [x] `get_call_graph()` resolves pending files before building graph ✓ (placeholder)
- [x] Query interface provides access to definitions, types, resolutions ✓
- [x] Basic unit tests pass ✓ (19/19 tests passing)
- [ ] Integration tests in sub-task 138.10 will validate end-to-end behavior

## Dependencies

- Sub-tasks 138.1-138.7 (all registries must be implemented)
- Note: Sub-task 138.9 will update `resolve_symbols()` signature

## Estimated Effort

- Implementation: 4-5 hours
- Testing: 2-3 hours
- Total: 6-8 hours

## Notes

- This is the integration point for all registries
- 4-phase update ensures correct ordering (track dependents before updating imports)
- Lazy resolution is key to performance
- Query interface provides clean abstraction for consumers
- More comprehensive tests will be added in sub-task 138.10

## Implementation Notes

### Completed Implementation

**Files Created:**
- `packages/core/src/project/project.ts` - Main Project coordinator class
- `packages/core/src/project/project.test.ts` - Unit tests (19 tests, all passing)

**Files Modified:**
- `packages/core/src/project/index.ts` - Added Project export
- `packages/core/src/index.ts` - Added Project and registries to main API

**Key Implementation Details:**

1. **Parsing Integration**: Added helper functions to handle tree-sitter parsing:
   - `detect_language()` - Detects language from file extension
   - `get_parser()` - Gets appropriate tree-sitter parser
   - `create_parsed_file()` - Creates ParsedFile object
   - This was necessary because `build_semantic_index` requires parsed tree, not raw content

2. **Definition Collection**: SemanticIndex stores definitions in separate maps (functions, classes, variables, etc.), so we collect them into a single array for DefinitionRegistry

3. **Import Extraction**: Created `extract_imports_from_definitions()` to convert ImportDefinitions to Import[] for ImportGraph:
   - Handles relative paths (removes leading `./`)
   - Adds file extensions when missing
   - Groups imports by source file

4. **Resolution Placeholder**: `resolve_file()` and `get_call_graph()` are placeholders pending sub-task 138.9:
   - `resolve_file()` checks file exists, then marks as resolved
   - `get_call_graph()` returns empty graph structure
   - Full implementation requires updated `resolve_symbols()` signature

5. **Error Handling**: Fixed resolve_file to check file existence BEFORE checking resolution status to ensure proper error throwing

**Test Results:**
- 19 Project tests: ✓ All passing
- 143 total project package tests: ✓ All passing

**Dependencies:**
- Requires all registries from sub-tasks 138.1-138.7: ✓ Complete
- Sub-task 138.9 will update resolve_symbols() signature for full resolution
- Sub-task 138.10 will add integration tests
