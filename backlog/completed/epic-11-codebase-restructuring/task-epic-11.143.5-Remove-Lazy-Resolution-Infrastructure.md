# Task: Remove Lazy Resolution Infrastructure

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Remove the now-unused lazy resolution infrastructure from Project class. This includes the `resolve_file()` public method, `resolve_all_pending()` private method, and updates to `get_stats()`.

**Note**: The `call_graph_cache` field was already removed in task 143.4.

## Context

With eager resolution implemented in tasks 143.2, 143.3, and 143.4:
- Files are resolved immediately in `update_file()` and `remove_file()`
- No more pending state to manage
- No call graph caching (removed in 143.4)
- `resolve_file()` is no longer needed
- `resolve_all_pending()` is no longer called

These methods are dead code and should be removed.

## Goals

1. Remove `resolve_file()` public method (~23 lines)
2. Remove `resolve_all_pending()` private method (~52 lines)
3. Update `get_stats()` to use new ResolutionRegistry interface
4. Update tests that call these methods
5. Clean up any remaining references
6. Verify no references to `call_graph_cache` remain (should already be gone from 143.4)

## Implementation

### 1. Remove resolve_file() Method

Delete this method from `project.ts` (around line 271-294):

```typescript
// DELETE THIS ENTIRE METHOD
/**
 * Resolve references in a specific file (lazy).
 * Only resolves if the file has invalidated resolutions.
 *
 * NOTE: Symbol resolution requires cross-file information (imports, exports, etc.),
 * so we resolve ALL pending files at once rather than one file at a time.
 * This ensures consistency and enables proper import resolution.
 *
 * @param file_id - The file to resolve
 */
resolve_file(file_id: FilePath): void {
  const semantic_index = this.semantic_indexes.get(file_id);
  if (!semantic_index) {
    throw new Error(`Cannot resolve file ${file_id}: not indexed`);
  }

  if (this.resolutions.is_file_resolved(file_id)) {
    return; // Already resolved, use cache
  }

  // Resolve all pending files (including this one)
  // Symbol resolution needs cross-file information, so we batch resolve
  this.resolve_all_pending();
}
```

### 2. Remove resolve_all_pending() Method

Delete this method from `project.ts` (around line 296-348):

```typescript
// DELETE THIS ENTIRE METHOD
/**
 * Ensure all files with pending resolutions are resolved.
 * Private helper used by get_call_graph().
 */
private resolve_all_pending(): void {
  if (this.root_folder === undefined) {
    throw new Error("Root folder not initialized");
  }

  const pending = this.resolutions.get_pending_files();
  if (pending.size === 0) {
    return; // Nothing to resolve
  }

  // Call resolve_symbols with all indices and registries
  const resolved = resolve_symbols(
    this.semantic_indexes,
    this.definitions,
    this.types,
    this.scopes,
    this.exports,
    this.imports,
    this.root_folder
  );

  // Populate resolution cache with results
  // resolved.resolved_references is a Map<LocationKey, SymbolId>
  // We need to convert LocationKey to ReferenceId and track file ownership
  for (const [loc_key, symbol_id] of resolved.resolved_references) {
    // Parse the location key to extract file path
    const [file_path_part, ...rest] = loc_key.split(":");
    const file_path = file_path_part as FilePath;

    // Find the matching reference in the semantic index
    const index = this.semantic_indexes.get(file_path);
    if (index) {
      const matching_ref = index.references.find((ref) => {
        const ref_key = location_key(ref.location);
        return ref_key === loc_key;
      });

      if (matching_ref) {
        // Construct ReferenceId from the reference's name and location
        const ref_id = reference_id(matching_ref.name, matching_ref.location);
        this.resolutions.set(ref_id, symbol_id, file_path);
      }
    }
  }
  // Mark all pending files as resolved
  for (const file_id of pending) {
    this.resolutions.mark_file_resolved(file_id);
  }
}
```

**Note**: This logic is now encapsulated in `group_resolutions_by_file()` and `resolve_files()` helpers.

### 3. Update get_stats() Method

Simplify `get_stats()` to use ResolutionRegistry's simpler stats:

```typescript
// BEFORE (around line 354-362)
get_stats() {
  const cache_stats = this.resolutions.get_stats();
  return {
    file_count: this.semantic_indexes.size,
    definition_count: this.definitions.size(),
    pending_resolution_count: cache_stats.pending_files,
    cached_resolution_count: cache_stats.total_resolutions,
  };
}
```

```typescript
// AFTER
get_stats() {
  const resolution_stats = this.resolutions.get_stats();
  return {
    file_count: this.semantic_indexes.size,
    definition_count: this.definitions.size(),
    resolution_count: resolution_stats.total_resolutions,
  };
}
```

## Testing

### Update Tests that Call resolve_file()

Find all tests that call `resolve_file()` and remove those calls:

```bash
# Find tests calling resolve_file
grep -r "resolve_file" packages/core/src/project/*.test.ts
```

Expected locations:
- `project.test.ts` - lines 50, 76
- `project.integration.test.ts` - possibly multiple locations

**Update pattern**:
```typescript
// BEFORE
project.update_file(file1, code);
project.resolve_file(file1);  // ← REMOVE THIS LINE
const call_graph = project.get_call_graph();
```

```typescript
// AFTER
project.update_file(file1, code);
// Resolution happens automatically in update_file()
const call_graph = project.get_call_graph();
```

### Remove Tests for Pending State

Delete or rewrite tests that check `pending_resolution_count`:

```typescript
// DELETE OR REWRITE these tests:
// - "should invalidate resolutions when file is updated" (lines 43-62)
// - "should invalidate dependent files when file is updated" (lines 64-86)
```

These tests were already updated in task 143.2, but verify they don't check pending state.

### Update get_stats() Tests

If there are tests checking `get_stats()` output, update them:

```typescript
// BEFORE
const stats = project.get_stats();
expect(stats.pending_resolution_count).toBe(0);
expect(stats.cached_resolution_count).toBeGreaterThan(0);
```

```typescript
// AFTER
const stats = project.get_stats();
expect(stats.resolution_count).toBeGreaterThan(0);
// No more pending_resolution_count
```

## Verification

After completing this task:

1. **Search for removed method calls**:
   ```bash
   # Should return no results
   grep -r "resolve_file\|resolve_all_pending\|call_graph_cache" packages/core/src/project/
   ```

2. **Run all tests**:
   ```bash
   npm test --workspace=@ariadnejs/core
   ```

3. **Verify no compilation errors**:
   ```bash
   npm run build --workspace=@ariadnejs/core
   ```

4. **Verify clean removal**:
   - No references to removed methods in any files
   - No references to `call_graph_cache` anywhere in Project
   - All tests pass without modifications

## Success Criteria

- [ ] `resolve_file()` method deleted (~23 lines)
- [ ] `resolve_all_pending()` method deleted (~52 lines)
- [ ] `get_stats()` updated (no pending_resolution_count)
- [ ] All test calls to `resolve_file()` removed
- [ ] All tests checking pending state removed or updated
- [ ] All tests passing
- [ ] No compilation errors
- [ ] No references to removed methods in codebase
- [ ] Verified no `call_graph_cache` references remain

## Notes

- This task removes ~100 lines of code
- Searches should be done carefully to catch all usages
- Integration tests may have more `resolve_file()` calls than unit tests
- This task demonstrates the simplification benefit of eager resolution

## Impact

**Lines removed**: ~100 lines
- `resolve_file()`: ~23 lines
- `resolve_all_pending()`: ~52 lines
- Updates to tests: ~25 lines
- `call_graph_cache` field: already removed in 143.4

**Benefits**:
- Simpler API (one less public method)
- Less code to maintain
- No pending state complexity
- No cache invalidation complexity
- Always-consistent state

## Dependencies

- **Requires**: task-epic-11.143.4 completed (get_call_graph simplified)
- **Blocks**: task-epic-11.143.6 (documentation updates)

## Estimated Effort

- Implementation: 0.5-1 hour
- Testing updates: 1.5-2 hours
- Verification: 0.5 hour
- **Total**: 2.5-3.5 hours
