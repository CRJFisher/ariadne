# Task: Implement Project Coordination Layer Architecture

**Epic**: Epic 11 - Codebase Restructuring
**Status**: Not Started
**Priority**: High
**Complexity**: High

## Overview

Implement a comprehensive `Project` coordination layer that manages the entire processing pipeline from file parsing through call graph detection. This architecture introduces a clear separation between file-local data, project-level aggregated registries, and cached resolution results, enabling efficient incremental updates during code editing workflows.

## Context

Currently, the processing pipeline consists of:

1. `build_semantic_index` - parses individual files, extracting definitions, references, scopes
2. `resolve_symbols` - performs call-reference → function/method/constructor resolution
3. `detect_call_graph` - builds call graphs from resolved references

The current design has several limitations:

- No clear separation between file-local and project-level data
- Limited incremental update support when files change
- Type processing is mixed into SemanticIndex (should be separate)
- No systematic invalidation strategy for dependent files
- Resolution happens eagerly without caching

## Goals

1. **Separate concerns into three distinct layers**:

   - **File Layer**: Immutable file-local data (SemanticIndex, DerivedData)
   - **Project Layer**: Aggregated cross-file registries (definitions, types, scopes, exports, imports)
   - **Resolution Layer**: Cached resolutions with smart invalidation

2. **Enable efficient incremental updates**:

   - When a file changes, only recompute file-local data
   - Update project registries incrementally
   - Invalidate only affected resolutions (changed file + dependents)
   - Lazy re-resolution on next query

3. **Extract type processing from SemanticIndex**:

   - Move `type_bindings`, `type_members`, `type_alias_metadata`, `exported_symbols`, `scope_to_definitions` to `DerivedData`
   - Keep SemanticIndex as pure parsing output
   - Create specialized TypeRegistry for cross-file type queries

4. **Implement dependency tracking**:
   - Bidirectional import graph (dependencies and dependents)
   - Know which files to invalidate when exports change
   - Support incremental re-resolution

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│  FILE LAYER (file-local, immutable once computed)          │
│  - SemanticIndex: raw parsed data (defs, refs, scopes)     │
│  - DerivedData: indexed structures (type_bindings, etc)    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PROJECT LAYER (aggregated, incrementally updated)          │
│  - DefinitionRegistry: all defs by SymbolId                 │
│  - TypeRegistry: all type info aggregated                   │
│  - ScopeRegistry: scope trees + queries                     │
│  - ExportRegistry: what each file exports                   │
│  - ImportGraph: file dependency graph                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  RESOLUTION LAYER (cached, invalidated on changes)          │
│  - ResolutionCache: ref_id → symbol_id mappings             │
│  - CallGraph: computed from resolutions                     │
└─────────────────────────────────────────────────────────────┘
```

### Core Data Structures

#### File Layer

```typescript
// Pure parsed data - no cross-file knowledge
interface SemanticIndex {
  file_id: FileId;
  definitions: Definition[];
  references: Reference[];
  scopes: Scope[];
  imports: Import[]; // track what this file imports
  // REMOVED: type_bindings, type_members, type_alias_metadata,
  //          exported_symbols, scope_to_definitions
}

// Derived structures for fast lookup - file-local only
interface DerivedData {
  file_id: FileId;
  // Type information
  type_bindings: Map<SymbolId, TypeInfo>; // symbol → its declared type
  type_members: Map<SymbolId, Member[]>; // type → members (class/interface)
  type_alias_metadata: Map<SymbolId, TypeAliasInfo>; // type alias → resolved type

  // Export information
  exported_symbols: Set<SymbolId>; // what this file exports

  // Scope indexing
  scope_to_definitions: Map<ScopeId, SymbolId[]>; // scope → symbols defined in it
}
```

#### Project Layer - Registries

```typescript
/**
 * Central registry for all definitions across the project.
 * Maintains bidirectional mapping: symbol → definition, file → symbols
 */
class DefinitionRegistry {
  private by_symbol: Map<SymbolId, Definition>;
  private by_file: Map<FileId, Set<SymbolId>>;

  /**
   * Update definitions for a file. Removes old definitions first.
   */
  update_file(file_id: FileId, definitions: Definition[]): void;

  /**
   * Get definition by symbol ID
   */
  get(symbol_id: SymbolId): Definition | undefined;

  /**
   * Get all definitions from a specific file
   */
  get_file_definitions(file_id: FileId): Definition[];

  /**
   * Remove all definitions from a file
   */
  remove_file(file_id: FileId): void;
}

/**
 * Central registry for type information.
 * Aggregates type bindings, members, and aliases from all files.
 */
class TypeRegistry {
  // Symbol → its declared/inferred type
  private type_bindings: Map<SymbolId, TypeInfo>;

  // Type SymbolId → its members (for classes, interfaces, structs)
  private type_members: Map<SymbolId, Member[]>;

  // Type alias SymbolId → what it resolves to
  private type_aliases: Map<SymbolId, TypeAliasInfo>;

  // Track which file contributed which types (for removal)
  private by_file: Map<
    FileId,
    {
      bindings: Set<SymbolId>;
      member_types: Set<SymbolId>;
      aliases: Set<SymbolId>;
    }
  >;

  /**
   * Update type information for a file
   */
  update_file(file_id: FileId, derived: DerivedData): void;

  /**
   * Get the type bound to a symbol
   */
  get_type_binding(symbol_id: SymbolId): TypeInfo | undefined;

  /**
   * Get members of a type at a specific location.
   * Uses file context to resolve type names in scope.
   */
  get_type_members_at_location(
    type_ref: TypeReference,
    file_context: FileId
  ): Member[] | undefined;

  /**
   * Resolve a type alias to its underlying type
   */
  resolve_type_alias(alias_id: SymbolId): TypeAliasInfo | undefined;

  /**
   * Remove all type info from a file
   */
  remove_file(file_id: FileId): void;
}

/**
 * Registry for scope trees and scope-based queries.
 * Each file has a scope tree; this registry aggregates them.
 */
class ScopeRegistry {
  // File → root scope of that file
  private scope_trees: Map<FileId, Scope>;

  // Flattened scope lookup by ScopeId
  private by_scope_id: Map<ScopeId, Scope>;

  /**
   * Update scope tree for a file
   */
  update_file(file_id: FileId, scopes: Scope[]): void;

  /**
   * Get the scope chain from a location (innermost to outermost)
   */
  get_enclosing_scopes(file_id: FileId, location: Location): Scope[];

  /**
   * Get scope by ID
   */
  get_scope(scope_id: ScopeId): Scope | undefined;

  /**
   * Get root scope for a file
   */
  get_file_root_scope(file_id: FileId): Scope | undefined;

  /**
   * Remove all scopes from a file
   */
  remove_file(file_id: FileId): void;
}

/**
 * Registry tracking what symbols each file exports.
 * Used for import resolution.
 */
class ExportRegistry {
  private exports: Map<FileId, Set<SymbolId>>;

  /**
   * Update exports for a file
   */
  update_file(file_id: FileId, exported: Set<SymbolId>): void;

  /**
   * Get all symbols exported by a file
   */
  get_exports(file_id: FileId): Set<SymbolId>;

  /**
   * Check if a file exports a specific symbol
   */
  exports_symbol(file_id: FileId, symbol_id: SymbolId): boolean;

  /**
   * Remove exports from a file
   */
  remove_file(file_id: FileId): void;
}

/**
 * Bidirectional import dependency graph.
 * Tracks both "who does this file import from" and "who imports from this file".
 */
class ImportGraph {
  // File A → Files that A imports from
  private dependencies: Map<FileId, Set<FileId>>;

  // File B → Files that import from B
  private dependents: Map<FileId, Set<FileId>>;

  /**
   * Update import relationships for a file.
   * Removes old relationships, establishes new ones.
   */
  update_file(file_id: FileId, imports: Import[]): void;

  /**
   * Get files that this file imports from
   */
  get_dependencies(file_id: FileId): Set<FileId>;

  /**
   * Get files that import from this file.
   * These are the files that need invalidation when this file changes.
   */
  get_dependents(file_id: FileId): Set<FileId>;

  /**
   * Get all files reachable from this file (transitive dependencies)
   */
  get_transitive_dependencies(file_id: FileId): Set<FileId>;

  /**
   * Remove all import relationships for a file
   */
  remove_file(file_id: FileId): void;
}
```

#### Resolution Layer

```typescript
/**
 * Cache for reference → symbol resolutions.
 * Tracks which files have valid cached resolutions.
 */
class ResolutionCache {
  // Reference ID → resolved Symbol ID
  private resolutions: Map<ReferenceId, SymbolId>;

  // File → all reference IDs in that file
  private by_file: Map<FileId, Set<ReferenceId>>;

  // Files with invalidated resolutions (need re-resolution)
  private pending: Set<FileId>;

  /**
   * Get cached resolution for a reference
   */
  get(ref_id: ReferenceId): SymbolId | undefined;

  /**
   * Cache a resolution
   */
  set(ref_id: ReferenceId, symbol_id: SymbolId, file_id: FileId): void;

  /**
   * Mark a file's resolutions as invalid. Add to pending set.
   */
  invalidate_file(file_id: FileId): void;

  /**
   * Check if a file has valid cached resolutions
   */
  is_file_resolved(file_id: FileId): boolean;

  /**
   * Get all files with pending resolutions
   */
  get_pending_files(): Set<FileId>;

  /**
   * Get all resolutions for a file
   */
  get_file_resolutions(file_id: FileId): Map<ReferenceId, SymbolId>;

  /**
   * Remove all resolutions for a file
   */
  remove_file(file_id: FileId): void;
}
```

### Project Coordinator

```typescript
/**
 * Main coordinator for the entire processing pipeline.
 * Manages incremental updates, lazy resolution, and call graph computation.
 */
class Project {
  // File-level data (immutable once computed)
  private semantic_indexes: Map<FileId, SemanticIndex> = new Map();
  private derived_data: Map<FileId, DerivedData> = new Map();

  // Project-level registries (aggregated, incrementally updated)
  private definitions: DefinitionRegistry = new DefinitionRegistry();
  private types: TypeRegistry = new TypeRegistry();
  private scopes: ScopeRegistry = new ScopeRegistry();
  private exports: ExportRegistry = new ExportRegistry();
  private imports: ImportGraph = new ImportGraph();

  // Resolution layer (cached with invalidation)
  private resolutions: ResolutionCache = new ResolutionCache();
  private call_graph_cache: CallGraph | null = null;

  /**
   * Add or update a file in the project.
   * This is the main entry point for incremental updates.
   *
   * Process:
   * 1. Track dependents (files that import from this file)
   * 2. Compute file-local data (SemanticIndex + DerivedData)
   * 3. Update all project registries
   * 4. Invalidate affected resolutions (this file + dependents)
   */
  update_file(file_id: FileId, content: string): void {
    // Phase 0: Track who depends on this file (before updating imports)
    const dependents = this.imports.get_dependents(file_id);

    // Phase 1: Compute file-local data
    const semantic_index = build_semantic_index(file_id, content);
    const derived = build_derived_data(semantic_index);

    this.semantic_indexes.set(file_id, semantic_index);
    this.derived_data.set(file_id, derived);

    // Phase 2: Update project-level registries
    this.definitions.update_file(file_id, semantic_index.definitions);
    this.types.update_file(file_id, derived);
    this.scopes.update_file(file_id, semantic_index.scopes);
    this.exports.update_file(file_id, derived.exported_symbols);
    this.imports.update_file(file_id, semantic_index.imports);

    // Phase 3: Invalidate affected resolutions
    this.resolutions.invalidate_file(file_id);
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file);
    }
    this.call_graph_cache = null; // invalidate call graph
  }

  /**
   * Remove a file from the project completely.
   */
  remove_file(file_id: FileId): void {
    const dependents = this.imports.get_dependents(file_id);

    // Remove from file-level stores
    this.semantic_indexes.delete(file_id);
    this.derived_data.delete(file_id);

    // Remove from registries
    this.definitions.remove_file(file_id);
    this.types.remove_file(file_id);
    this.scopes.remove_file(file_id);
    this.exports.remove_file(file_id);
    this.imports.remove_file(file_id);

    // Invalidate resolutions
    this.resolutions.remove_file(file_id);
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file);
    }
    this.call_graph_cache = null;
  }

  /**
   * Resolve references in a specific file (lazy).
   * Only resolves if the file has invalidated resolutions.
   */
  resolve_file(file_id: FileId): void {
    if (this.resolutions.is_file_resolved(file_id)) {
      return; // already resolved, use cache
    }

    const semantic_index = this.semantic_indexes.get(file_id);
    if (!semantic_index) {
      throw new Error(`Cannot resolve file ${file_id}: not indexed`);
    }

    // Call resolve_symbols with registry access
    const resolved = resolve_symbols(
      semantic_index,
      this.definitions,
      this.types,
      this.scopes,
      this.exports,
      this.imports
    );

    // Cache all resolutions
    for (const [ref_id, symbol_id] of resolved) {
      this.resolutions.set(ref_id, symbol_id, file_id);
    }
  }

  /**
   * Ensure all files with pending resolutions are resolved.
   */
  private resolve_all_pending(): void {
    const pending = this.resolutions.get_pending_files();
    for (const file_id of pending) {
      this.resolve_file(file_id);
    }
  }

  /**
   * Get the call graph (builds if needed).
   * Triggers resolution of all pending files.
   */
  get_call_graph(): CallGraph {
    if (this.call_graph_cache) {
      return this.call_graph_cache;
    }

    this.resolve_all_pending();

    this.call_graph_cache = detect_call_graph(
      this.resolutions,
      this.definitions
    );

    return this.call_graph_cache;
  }

  /**
   * Query interface: get definition by symbol
   */
  get_definition(symbol_id: SymbolId): Definition | undefined {
    return this.definitions.get(symbol_id);
  }

  /**
   * Query interface: resolve a specific reference
   */
  resolve_reference(
    ref_id: ReferenceId,
    file_id: FileId
  ): SymbolId | undefined {
    this.resolve_file(file_id); // ensure file is resolved
    return this.resolutions.get(ref_id);
  }

  /**
   * Query interface: get all definitions in a file
   */
  get_file_definitions(file_id: FileId): Definition[] {
    return this.definitions.get_file_definitions(file_id);
  }

  /**
   * Query interface: get type information
   */
  get_type_info(symbol_id: SymbolId): TypeInfo | undefined {
    return this.types.get_type_binding(symbol_id);
  }

  /**
   * Query interface: get files that import from this file
   */
  get_dependents(file_id: FileId): Set<FileId> {
    return this.imports.get_dependents(file_id);
  }
}
```

## Update Flow

```
File Change (update_file called)
    ↓
┌──────────────────────────────────────────────────────┐
│ Phase 0: Track dependents before import update      │
│   dependents = imports.get_dependents(file_id)      │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│ Phase 1: Compute file-local data                    │
│   semantic_index = build_semantic_index(content)    │
│   derived = build_derived_data(semantic_index)      │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│ Phase 2: Update all project registries              │
│   definitions.update_file(file_id, ...)             │
│   types.update_file(file_id, derived)               │
│   scopes.update_file(file_id, scopes)               │
│   exports.update_file(file_id, exported)            │
│   imports.update_file(file_id, imports)             │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│ Phase 3: Invalidate affected resolutions            │
│   resolutions.invalidate_file(file_id)              │
│   for dependent in dependents:                      │
│     resolutions.invalidate_file(dependent)          │
│   call_graph_cache = null                           │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│ Phase 4: Lazy resolution (on next query)            │
│   When get_call_graph() or resolve_file() called:  │
│   - Check resolutions.is_file_resolved()            │
│   - If false, call resolve_symbols()                │
│   - Cache results in resolutions                    │
└──────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. DerivedData Separation

- **Rationale**: SemanticIndex should be pure parsing output; derived structures are a separate indexing concern
- **What moves**: `type_bindings`, `type_members`, `type_alias_metadata`, `exported_symbols`, `scope_to_definitions`
- **Benefits**: Clear separation of concerns, easier to test parsing vs indexing

### 2. Registry Pattern

- **Rationale**: Centralize cross-file data access, enable incremental updates
- **Key operations**: `update_file()`, `get()`, `remove_file()`
- **Benefits**: Single source of truth, consistent update semantics

### 3. Lazy Resolution

- **Rationale**: Avoid cascading recomputation on file edits
- **Strategy**: Mark files as pending, resolve on next query
- **Benefits**: Fast update_file() calls, work done only when needed

### 4. Bidirectional Import Graph

- **Rationale**: Need to know both "what I import" and "who imports me"
- **Use case**: When file A changes, invalidate all files that import from A
- **Benefits**: Precise invalidation, no over-invalidation

### 5. Invalidation Granularity

- **What invalidates**: Changed file + its dependents (files that import from it)
- **What doesn't invalidate**: Unrelated files, files that the changed file imports from
- **Benefits**: Minimal re-resolution work

### 6. Type Resolution Strategy

- **File-local**: Extract type annotations from syntax, build type_bindings
- **Project-level**: Aggregate into TypeRegistry for cross-file queries
- **Location-based**: Use file context to resolve type names to SymbolIds
- **Benefits**: Supports cross-file type resolution while maintaining locality

## Implementation Strategy

This task is broken down into **11 sub-tasks** that can be implemented sequentially:

### Sub-task 138.1: Extract DerivedData from SemanticIndex

- Create `DerivedData` interface
- Implement `build_derived_data()` function
- Move extraction logic from semantic_index.ts
- Update SemanticIndex return type (remove moved fields)
- Update all tests

### Sub-task 138.2: Implement DefinitionRegistry

- Create `DefinitionRegistry` class
- Implement bidirectional mapping (symbol ↔ file)
- Add update/get/remove operations
- Write comprehensive unit tests

### Sub-task 138.3: Implement TypeRegistry

- Create `TypeRegistry` class
- Aggregate type_bindings, type_members, type_aliases
- Implement location-based type lookup
- Write unit tests with cross-file scenarios

### Sub-task 138.4: Implement ScopeRegistry

- Create `ScopeRegistry` class
- Store scope trees per file
- Implement `get_enclosing_scopes()` for lexical lookup
- Write unit tests with nested scopes

### Sub-task 138.5: Implement ExportRegistry

- Create `ExportRegistry` class
- Track exported symbols per file
- Implement update/get operations
- Write unit tests

### Sub-task 138.6: Implement ImportGraph

- Create `ImportGraph` class
- Implement bidirectional tracking (dependencies + dependents)
- Add `get_transitive_dependencies()` for deep dependency queries
- Write unit tests with complex import chains

### Sub-task 138.7: Implement ResolutionCache

- Create `ResolutionCache` class
- Track pending files (invalidated but not re-resolved)
- Implement invalidation logic
- Write unit tests for cache invalidation scenarios

### Sub-task 138.8: Implement Project Coordinator

- Create `Project` class with all registries
- Implement `update_file()` with 4-phase update flow
- Implement `resolve_file()` with lazy resolution
- Implement `get_call_graph()` with cache
- Add query interface methods

### Sub-task 138.9: Update resolve_symbols to Accept Registries

- Refactor `resolve_symbols()` signature to accept registries
- Remove direct SemanticIndex field access
- Use registry queries instead
- Update all resolution logic
- Update tests

### Sub-task 138.10: Add Incremental Update Integration Tests

- Test file update → registry update → invalidation flow
- Test dependent file invalidation
- Test lazy re-resolution
- Test call graph cache invalidation
- Test multi-file update scenarios

### Sub-task 138.11: Add Performance Benchmarks

- Benchmark update_file() performance
- Benchmark resolution cache hit rate
- Benchmark incremental vs full rebuild
- Compare memory usage of old vs new architecture
- Document performance characteristics

## Success Criteria

1. ✅ All sub-tasks completed and passing tests
2. ✅ SemanticIndex no longer contains derived data structures
3. ✅ All registries support incremental updates (update_file, remove_file)
4. ✅ ImportGraph correctly tracks bidirectional dependencies
5. ✅ ResolutionCache correctly invalidates affected files
6. ✅ Project.update_file() completes in O(file_size) time (not O(project_size))
7. ✅ Lazy resolution only resolves files when needed
8. ✅ Call graph cache invalidates correctly on file changes
9. ✅ All existing tests pass with new architecture
10. ✅ Performance benchmarks show improvement for incremental updates

## Migration Path

1. **Phase 1** (138.1): Extract DerivedData - can coexist with old code
2. **Phase 2** (138.2-138.7): Implement all registries - can test in isolation
3. **Phase 3** (138.8): Implement Project coordinator - integration point
4. **Phase 4** (138.9): Update resolve_symbols - breaking change, requires coordination
5. **Phase 5** (138.10-138.11): Test and benchmark - validation

## Dependencies

- Requires current SemanticIndex structure (definitions, references, scopes)
- Requires current resolve_symbols implementation (to be refactored)
- Requires FileId, SymbolId, ReferenceId types from @ariadnejs/types

## Risks and Mitigations

**Risk**: Large refactor, hard to test incrementally
**Mitigation**: Sub-tasks designed to be independently testable; registries can be tested before integration

**Risk**: Performance regression if invalidation is too broad
**Mitigation**: Sub-task 138.11 includes benchmarks; ImportGraph precisely tracks dependents

**Risk**: Breaking changes to resolve_symbols affect many tests
**Mitigation**: Sub-task 138.9 is isolated; update tests in same commit

**Risk**: Memory overhead from maintaining multiple registries
**Mitigation**: Registries use shared references, not copies; benchmark in 138.11

## Notes

- This architecture is inspired by incremental compilation systems (Rust, TypeScript)
- The three-layer separation (file/project/resolution) is critical for performance
- Lazy resolution is key to fast edit-compile cycles
- Bidirectional import graph is essential for precise invalidation
- Location-based type lookup enables cross-file method resolution (needed for Epic 11.136)

## Implementation Notes

(This section will be updated as sub-tasks are completed)

---

## Sub-Tasks

See individual task files for detailed implementation plans:

- [ ] task-epic-11.138.1 - Extract DerivedData from SemanticIndex
- [ ] task-epic-11.138.2 - Implement DefinitionRegistry
- [ ] task-epic-11.138.3 - Implement TypeRegistry
- [ ] task-epic-11.138.4 - Implement ScopeRegistry
- [ ] task-epic-11.138.5 - Implement ExportRegistry
- [ ] task-epic-11.138.6 - Implement ImportGraph
- [ ] task-epic-11.138.7 - Implement ResolutionCache
- [ ] task-epic-11.138.8 - Implement Project Coordinator
- [ ] task-epic-11.138.9 - Update resolve_symbols to Accept Registries
- [ ] task-epic-11.138.10 - Add Incremental Update Integration Tests
- [ ] task-epic-11.138.11 - Add Performance Benchmarks
