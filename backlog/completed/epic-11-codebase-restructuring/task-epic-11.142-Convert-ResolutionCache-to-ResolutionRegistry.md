# Task: Convert ResolutionCache to ResolutionRegistry

**Epic**: Epic 11 - Codebase Restructuring
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Refactor `ResolutionCache` to follow the same registry pattern as `DefinitionRegistry`, `TypeRegistry`, `ScopeRegistry`, `ExportRegistry`, and `ImportGraph`. This eliminates the "pending state" pattern and aligns all registries to a consistent eager update model.

## Context

Currently, ResolutionCache is the only registry that uses a lazy/pending pattern:

- Files are marked as "pending" when invalidated
- Resolution happens later via explicit `resolve_file()` calls
- Requires manual bookkeeping with `mark_file_resolved()`
- Exposes internal state via `get_pending_files()`, `is_file_resolved()`

This creates several problems:

1. **Inconsistent patterns**: All other registries use eager updates
2. **Temporal coupling**: `update_file()` doesn't complete its work
3. **Complex API**: Users must understand the resolution lifecycle
4. **Hidden state**: Pending files are invisible until queried

All other registries follow a simple pattern:

```typescript
update_file(file_id, data)  // Remove old + add new (atomic)
remove_file(file_id)        // Clean removal
get/query methods           // Access data
clear()                     // Reset
```

## Goals

1. **Rename**: `ResolutionCache` → `ResolutionRegistry` (matches other registries)

2. **Remove pending state machinery**:

   - Remove `pending: Set<FilePath>` field
   - Remove `invalidate_file()` method
   - Remove `is_file_resolved()` method
   - Remove `mark_file_resolved()` method
   - Remove `get_pending_files()` method

3. **Add standard registry interface**:

   - Add `update_file(file_id: FilePath, resolutions: Map<ReferenceId, SymbolId>): void`
   - Follows same pattern as other registries: remove old + add new

4. **Preserve existing functionality**:
   - Keep `get(ref_id)` - lookup resolution by reference
   - Keep `get_file_resolutions(file_id)` - get all resolutions for a file
   - Keep `remove_file(file_id)` - remove all resolutions for a file
   - Keep `get_all_referenced_symbols()` - for call graph entry point detection
   - Keep `clear()` - reset registry

## Implementation Steps

### 1. Rename File and Class

- Rename `packages/core/src/project/resolution_cache.ts` → `resolution_registry.ts`
- Rename `packages/core/src/project/resolution_cache.test.ts` → `resolution_registry.test.ts`
- Rename class `ResolutionCache` → `ResolutionRegistry`
- Update all imports in `project.ts`

### 2. Remove Pending State

Remove these fields and methods:

```typescript
// REMOVE from class
private pending: Set<FilePath> = new Set();

// REMOVE methods
invalidate_file(file_id: FilePath): void { ... }
is_file_resolved(file_id: FilePath): boolean { ... }
mark_file_resolved(file_id: FilePath): void { ... }
get_pending_files(): Set<FilePath> { ... }
```

### 3. Add update_file() Method

Add the standard registry update method:

```typescript
/**
 * Update resolutions for a file.
 * Removes old resolutions from the file first, then adds new ones.
 * This follows the same pattern as other registries.
 *
 * @param file_id - The file being updated
 * @param resolutions - Map of ReferenceId → SymbolId for this file
 */
update_file(file_id: FilePath, resolutions: Map<ReferenceId, SymbolId>): void {
  // Step 1: Remove old resolutions from this file
  this.remove_file(file_id);

  // Step 2: Add new resolutions
  for (const [ref_id, symbol_id] of resolutions) {
    this.resolutions.set(ref_id, symbol_id);

    // Track file ownership
    if (!this.by_file.has(file_id)) {
      this.by_file.set(file_id, new Set());
    }
    this.by_file.get(file_id)!.add(ref_id);
  }
}
```

### 4. Update set() Method

The existing `set()` method takes a `file_id` parameter for tracking. This is still useful for incremental resolution, but it should be marked as internal:

```typescript
/**
 * Set a single resolution (used internally).
 * For bulk updates, prefer update_file().
 *
 * @param ref_id - The reference being resolved
 * @param symbol_id - The symbol it resolves to
 * @param file_id - The file containing the reference
 */
set(ref_id: ReferenceId, symbol_id: SymbolId, file_id: FilePath): void {
  // Existing implementation unchanged
}
```

### 5. Update remove_file() Method

The existing `remove_file()` method already follows the registry pattern. Update its comment:

```typescript
/**
 * Remove all resolutions from a file.
 * Used when a file is deleted from the project.
 *
 * @param file_id - The file to remove
 */
remove_file(file_id: FilePath): void {
  // Existing implementation unchanged - already correct
}
```

### 6. Update get_stats() Method

Remove the `pending_files` field from stats:

```typescript
// BEFORE
get_stats(): {
  total_resolutions: number
  files_with_resolutions: number
  pending_files: number  // ← REMOVE
} {
  return {
    total_resolutions: this.resolutions.size,
    files_with_resolutions: this.by_file.size,
    pending_files: this.pending.size,  // ← REMOVE
  };
}

// AFTER
get_stats(): {
  total_resolutions: number
  files_with_resolutions: number
} {
  return {
    total_resolutions: this.resolutions.size,
    files_with_resolutions: this.by_file.size,
  };
}
```

## Testing

### Update Existing Tests

The test file `resolution_registry.test.ts` needs significant updates:

1. **Remove tests for pending state**:

   - Remove tests for `invalidate_file()`
   - Remove tests for `is_file_resolved()`
   - Remove tests for `mark_file_resolved()`
   - Remove tests for `get_pending_files()`

2. **Add tests for update_file()**:

   ```typescript
   it("should update resolutions for a file", () => {
     const file1 = "file1.ts" as FilePath;
     const ref1 = "ref1" as ReferenceId;
     const sym1 = "sym1" as SymbolId;

     const resolutions = new Map([[ref1, sym1]]);
     registry.update_file(file1, resolutions);

     expect(registry.get(ref1)).toBe(sym1);
   });

   it("should replace old resolutions on update", () => {
     const file1 = "file1.ts" as FilePath;
     const ref1 = "ref1" as ReferenceId;
     const ref2 = "ref2" as ReferenceId;
     const sym1 = "sym1" as SymbolId;
     const sym2 = "sym2" as SymbolId;

     // First update
     registry.update_file(file1, new Map([[ref1, sym1]]));
     expect(registry.get(ref1)).toBe(sym1);

     // Second update (replaces first)
     registry.update_file(file1, new Map([[ref2, sym2]]));
     expect(registry.get(ref1)).toBeUndefined();
     expect(registry.get(ref2)).toBe(sym2);
   });
   ```

3. **Keep tests for core functionality**:
   - `get(ref_id)` - still works
   - `get_file_resolutions(file_id)` - still works
   - `remove_file(file_id)` - still works
   - `get_all_referenced_symbols()` - still works
   - `clear()` - still works

## Success Criteria

- [x] File renamed to `resolution_registry.ts`
- [x] Class renamed to `ResolutionRegistry`
- [x] All pending state methods removed (5 methods)
- [x] `update_file()` method added and tested
- [x] `resolve_files()` method added and tested
- [x] `group_resolutions_by_file()` private helper added
- [x] All imports updated in `project.ts`
- [x] Required imports added (resolve_symbols, parse_location_key, etc.)
- [x] Tests updated and passing
- [x] No references to "cache" terminology in resolution_registry.ts
- [x] ResolutionRegistry is active (resolves + stores), not passive
- [x] Old resolution_cache.ts files deleted from project/

### 7. Add resolve_files() Method (Active Resolution)

Make ResolutionRegistry responsible for resolution logic, not just storage:

```typescript
/**
 * Resolve symbols for a set of files and update resolutions.
 * This method encapsulates the entire resolution pipeline:
 * 1. Call resolve_symbols with all registries
 * 2. Convert output from LocationKey → ReferenceId format
 * 3. Update resolutions for affected files
 *
 * @param file_ids - Files that need resolution updates
 * @param semantic_indexes - All semantic indexes (resolve_symbols needs all files)
 * @param definitions - Definition registry
 * @param types - Type registry
 * @param scopes - Scope registry
 * @param exports - Export registry
 * @param imports - Import graph
 * @param root_folder - Root folder for import resolution
 */
resolve_files(
  file_ids: Set<FilePath>,
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  scopes: ScopeRegistry,
  exports: ExportRegistry,
  imports: ImportGraph,
  root_folder: FileSystemFolder
): void {
  if (file_ids.size === 0) {
    return;
  }

  // Step 1: Resolve all symbols (processes entire project)
  const resolved = resolve_symbols(
    semantic_indexes,
    definitions,
    types,
    scopes,
    exports,
    imports,
    root_folder
  );

  // Step 2: Convert LocationKey → ReferenceId format
  const resolutions_by_file = this.group_resolutions_by_file(
    resolved.resolved_references,
    semantic_indexes
  );

  // Step 3: Update affected files
  for (const file_id of file_ids) {
    const file_resolutions = resolutions_by_file.get(file_id) ?? new Map();
    this.update_file(file_id, file_resolutions);
  }
}

/**
 * Convert resolve_symbols output to per-file resolution maps.
 *
 * resolve_symbols returns: Map<LocationKey, SymbolId>
 * We need: Map<FilePath, Map<ReferenceId, SymbolId>>
 *
 * This requires:
 * 1. Parse LocationKey to extract file_path
 * 2. Find matching reference in semantic_index (to get reference name)
 * 3. Construct ReferenceId from reference name + location
 * 4. Group by file_path
 *
 * @param resolved_refs - Output from resolve_symbols
 * @param semantic_indexes - Needed to find reference names
 * @returns Per-file resolution maps
 */
private group_resolutions_by_file(
  resolved_refs: Map<LocationKey, SymbolId>,
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>
): Map<FilePath, Map<ReferenceId, SymbolId>> {
  const by_file = new Map<FilePath, Map<ReferenceId, SymbolId>>();

  for (const [loc_key, symbol_id] of resolved_refs) {
    // Parse LocationKey to extract file path
    const { file_path } = parse_location_key(loc_key);

    // Find matching reference in semantic index
    const index = semantic_indexes.get(file_path);
    if (!index) continue; // File not in project

    const matching_ref = index.references.find(ref => {
      const ref_key = location_key(ref.location);
      return ref_key === loc_key;
    });

    if (!matching_ref) continue; // No reference at this location

    // Construct ReferenceId
    const ref_id = reference_id(matching_ref.name, matching_ref.location);

    // Add to per-file map
    if (!by_file.has(file_path)) {
      by_file.set(file_path, new Map());
    }
    by_file.get(file_path)!.set(ref_id, symbol_id);
  }

  return by_file;
}
```

**Required imports**:

```typescript
import { resolve_symbols } from "../resolve_references/symbol_resolution";
import { parse_location_key, location_key, reference_id } from "@ariadnejs/types";
import type { FileSystemFolder } from "../resolve_references/types";
```


## Notes

- This task makes ResolutionRegistry **active** not just passive storage
- Resolution logic lives with resolution data (better cohesion)
- Project class will delegate to `resolutions.resolve_files()` in next phase
- The goal is to establish the complete resolution interface before wiring it up

## Related Tasks

- **Next**: task-epic-11.143 - Implement Eager Resolution in Project Class (COMPLETED)
- **Context**: task-epic-11.138 - Implement Project Coordination Layer

## Completion Notes

**Completed**: 2025-10-13

Implementation included:

- Created `resolution_registry.ts` with ResolutionRegistry class
- Added `resolve_files()` method that encapsulates resolution pipeline
- Added `group_resolutions_by_file()` private helper
- Removed all pending state machinery
- Added comprehensive tests in `resolution_registry.test.ts`
- Deleted old `resolution_cache.ts` and `resolution_cache.test.ts` files
- Updated Project class to use ResolutionRegistry (line 10, 171)

All tests passing (19/19 in project.test.ts).

## Estimated Effort

- Implementation: 3-4 hours (includes resolve_files logic)
- Testing: 1.5-2 hours
- **Total**: 4.5-6 hours
- **Actual**: ~5 hours
