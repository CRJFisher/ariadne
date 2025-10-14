# Task: Merge TypeContext into TypeRegistry

**Epic**: Epic 11 - Codebase Restructuring
**Status**: Not Started
**Priority**: High
**Complexity**: High

## Overview

Consolidate type information management by merging TypeContext functionality directly into TypeRegistry. This eliminates redundant adapter layers and establishes the registry pattern where `update_file()` handles all work including resolution.

## Context

Currently, type information is fragmented across three components:

1. **TypeRegistry** - Stores type metadata as **names** (parent class names, member names)
2. **TypeContext** (interface) - Defines type query operations returning **SymbolIds**
3. **build_type_context_eager()** - Adapter that converts names → SymbolIds

**Problems:**
- Type names are resolved repeatedly (every time `resolve_calls()` is invoked)
- TypeContext is just an adapter layer with no persistent state
- Overlapping responsibilities between TypeRegistry and TypeContext
- Doesn't follow the registry pattern (update_file should handle everything)

**Current Flow:**
```typescript
// In Project.update_file()
this.types.update_file(file_id, index);              // Stores names
this.resolutions.resolve_files(...);                  // Resolves symbols
// TypeRegistry resolution happens in resolve_calls() - repeated every call!
```

## Goals

1. **Consolidate Storage**: TypeRegistry stores SymbolIds directly, not names
2. **Eliminate Adapters**: Remove TypeContext interface and build_type_context_eager()
3. **Registry Pattern**: TypeRegistry.update_file() handles extraction AND resolution
4. **Performance**: Type metadata resolved once during update, not repeatedly
5. **Consistency**: Align with eager resolution architecture from Epic 11.143

## Proposed Architecture

```typescript
class TypeRegistry {
  // ===== Storage (SymbolId-based) =====
  private symbol_types: Map<SymbolId, SymbolId>;            // variable → type_id
  private type_members: Map<SymbolId, Map<SymbolName, SymbolId>>; // type → members
  private parent_classes: Map<SymbolId, SymbolId>;          // class → parent
  private implemented_interfaces: Map<SymbolId, SymbolId[]>; // class → interfaces

  // ===== Public API =====
  update_file(
    file_id: FilePath,
    index: SemanticIndex,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry
  ): void {
    this.extract_type_data(file_id, index);           // Phase 1: Extract names
    this.resolve_type_metadata(file_id, definitions, resolutions); // Phase 2: Resolve
  }

  // ===== TypeContext Methods (direct implementation) =====
  get_symbol_type(symbol_id: SymbolId): SymbolId | null
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null
  get_parent_class(class_id: SymbolId): SymbolId | null
  get_implemented_interfaces(class_id: SymbolId): SymbolId[]
  walk_inheritance_chain(class_id: SymbolId): SymbolId[]

  // ===== Private Methods =====
  private extract_type_data(file_id, index): void
  private resolve_type_metadata(file_id, definitions, resolutions): void
}
```

**New Flow in Project:**
```typescript
// Phase 1: Index file
const index = index_single_file(...);

// Phase 2: Update non-type registries (pure data storage)
this.definitions.update_file(file_id, index);
this.scopes.update_file(file_id, index);
this.exports.update_file(file_id, index);
this.imports.update_file(file_id, imports);

// Phase 3: Resolve references (needs all registries above)
this.resolutions.resolve_files(affected_files, ...);

// Phase 4: Update type registry (needs resolutions!)
for (const affected_file of affected_files) {
  const affected_index = this.semantic_indexes.get(affected_file);
  this.types.update_file(
    affected_file,
    affected_index,
    this.definitions,
    this.resolutions
  );
}
```

## Benefits

1. **Performance**: Type metadata resolved once per update vs repeatedly per call
2. **Simplicity**: One component (TypeRegistry) instead of three
3. **Consistency**: Follows registry pattern like all other registries
4. **Maintainability**: All type logic in one place
5. **Memory**: Persistent SymbolId maps instead of rebuilding on every call

## Registry Pattern

This task establishes the **registry pattern** used throughout the codebase:

```typescript
interface Registry {
  /** Update a file with new data, performing all necessary processing */
  update_file(file_id: FilePath, ...dependencies): void;

  /** Remove all data for a file */
  remove_file(file_id: FilePath): void;

  /** Clear all data */
  clear(): void;
}
```

**Registry Categories:**

1. **Pure Registries** (no cross-registry dependencies):
   - DefinitionRegistry
   - ScopeRegistry
   - ExportRegistry
   - ImportGraph

2. **Resolution-Dependent Registries** (need ResolutionRegistry):
   - TypeRegistry (this task!)

**Update Order:**
1. Pure registries (parallel, no dependencies)
2. ResolutionRegistry (depends on all pure registries)
3. Resolution-dependent registries (depend on ResolutionRegistry)

## Subtasks

This epic is broken into 7 sequential subtasks:

1. **11.144.1** - Add SymbolId storage to TypeRegistry
2. **11.144.2** - Implement TypeContext methods on TypeRegistry
3. **11.144.3** - Move TypeRegistry update after resolution in Project
4. **11.144.4** - Update call resolvers to use TypeRegistry directly
5. **11.144.5** - Delete TypeContext infrastructure
6. **11.144.6** - Clean up legacy name-based storage
7. **11.144.7** - Document registry pattern

See individual subtask files for detailed implementation steps.

## Key Design Decisions

### 1. Call TypeRegistry.update_file() After Resolution

**Why:** TypeRegistry needs ResolutionRegistry to convert type names → SymbolIds

**Implementation:**
- TypeRegistry.update_file() called AFTER ResolutionRegistry.resolve_files()
- TypeRegistry.update_file() takes `resolutions` parameter
- Handles both extraction and resolution internally

### 2. Private resolve_type_metadata() Method

**Why:** Encapsulation - resolution is an internal detail

**Implementation:**
- `resolve_type_metadata()` is private
- Called automatically from `update_file()`
- No external API for partial resolution

### 3. Skip get_namespace_member() Initially

**Why:** Namespace member resolution is complex and rarely used

**Decision:**
- Leave as TODO or stub
- Handle in separate task if needed
- Focus on core type resolution first

### 4. No Strict Registry Interface (Yet)

**Why:** TypeScript allows structural typing, different registries need different parameters

**Decision:**
- Document pattern in CLAUDE.md
- Consider interface in task 11.144.7
- For now, convention > enforcement

## Testing Strategy

1. **Unit Tests**: Each subtask adds comprehensive tests
2. **Integration Tests**: Update project.test.ts to verify end-to-end flow
3. **Regression Tests**: Ensure all existing type resolution tests pass
4. **Performance Tests**: Benchmark before/after to verify improvements

## Dependencies

- **Requires**: Epic 11.143 completed (eager resolution in Project)
- **Blocks**: None (but improves performance for all call resolution)

## Estimated Effort

- Task 11.144.1: 2-3 hours (storage + private method)
- Task 11.144.2: 3-4 hours (implement all TypeContext methods)
- Task 11.144.3: 2-3 hours (restructure Project flow)
- Task 11.144.4: 2-3 hours (update resolvers)
- Task 11.144.5: 1 hour (deletions)
- Task 11.144.6: 2-3 hours (cleanup + optimization)
- Task 11.144.7: 1-2 hours (documentation)
- **Total**: 13-19 hours

## Success Criteria

- [ ] TypeRegistry stores all type data as SymbolIds (not names)
- [ ] TypeRegistry implements get_symbol_type(), get_type_member(), etc.
- [ ] TypeRegistry.update_file() called after resolution in Project
- [ ] Method/constructor resolution uses TypeRegistry directly
- [ ] TypeContext interface deleted
- [ ] build_type_context_eager() deleted
- [ ] All tests pass
- [ ] Performance improved (type resolution happens once per update)
- [ ] Registry pattern documented

## Notes

- This completes the transition to eager resolution started in Epic 11.143
- Establishes architectural pattern for all future registries
- Significant performance improvement expected (no repeated resolution)
- Simplifies codebase by ~200 lines (deletes type_context_eager.ts)
