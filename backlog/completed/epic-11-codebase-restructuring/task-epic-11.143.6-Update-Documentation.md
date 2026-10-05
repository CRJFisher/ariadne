# Task: Update Documentation

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: Medium
**Complexity**: Low

## Overview

Update all documentation in Project class to reflect the eager resolution architecture. This includes class-level comments, method comments, inline comments, and any architecture docs.

## Context

The Project class has undergone a significant architectural change from lazy to eager resolution, with cache removal. Documentation needs to be updated to:
- Remove references to "lazy" or "pending" resolution
- Remove references to call graph "caching" or "invalidation"
- Explain eager resolution model
- Update phase descriptions in comments
- Clarify that state is always consistent
- Note that resolution logic lives in ResolutionRegistry

## Goals

1. Update class-level documentation
2. Update method-level documentation
3. Update inline comments
4. Verify no stale comments remain
5. Check if any architecture docs need updates

## Implementation

### 1. Update Class-Level Documentation

Update the class comment at the top of Project class (around line 142-152):

```typescript
// BEFORE
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
```

```typescript
// AFTER
/**
 * Main coordinator for the entire processing pipeline.
 *
 * Manages:
 * - File-level data (SemanticIndex per file)
 * - Project-level registries (definitions, types, scopes, exports, imports)
 * - Symbol resolution (eager, always up-to-date)
 * - Call graph computation
 *
 * Architecture:
 * - When a file changes, recompute file-local data
 * - Update all registries incrementally
 * - Immediately re-resolve affected files (updated file + dependents)
 * - State is always consistent - no "pending" or "stale" data
 *
 * Provides efficient incremental updates: only affected files are re-parsed
 * and re-resolved, while unchanged files reuse cached results.
 */
```

### 2. Update Method Documentation

Method documentation was updated in previous tasks, but verify consistency:

**update_file()** (should already be updated in 143.2):
```typescript
/**
 * Add or update a file in the project.
 * This is the main entry point for incremental updates.
 *
 * Process (3 phases):
 * 0. Track dependents before updating import graph
 * 1. Compute file-local data (SemanticIndex)
 * 2. Update all project registries
 * 3. Re-resolve affected files (this file + dependents)
 *
 * After this method completes, all project state is consistent and up-to-date.
 *
 * @param file_id - The file to update
 * @param content - The file's source code
 */
```

**remove_file()** (should already be updated in 143.3):
```typescript
/**
 * Remove a file from the project completely.
 * Removes all file-local data, registry entries, and resolutions.
 * Re-resolves dependent files to update their import resolutions.
 *
 * @param file_id - The file to remove
 */
```

**get_call_graph()** (should already be updated in 143.4):
```typescript
/**
 * Get the call graph for the project.
 *
 * Builds the call graph from current state. All resolutions are maintained
 * up-to-date by update_file() and remove_file(), so this method always returns
 * accurate results.
 *
 * Note: This method does not cache. If you need to call it multiple times,
 * consider caching the result yourself.
 *
 * @returns The call graph
 */
```

### 3. Update Inline Comments

Check for inline comments mentioning "pending", "lazy", "invalidate", "cache":

```bash
# Find potentially stale comments
grep -n "pending\|lazy\|invalidate\|cache" packages/core/src/project/project.ts
```

Update any stale comments. Examples:

```typescript
// BEFORE
// Phase 3: Invalidate affected resolutions (this file + dependents)

// AFTER
// Phase 3: Re-resolve affected files (this file + dependents)
```

```typescript
// BEFORE (should already be removed in 143.4)
private call_graph_cache: CallGraph | null = null; // Invalidated on updates

// AFTER
// (This field no longer exists - removed in task 143.4)
```

### 4. Update Private Member Comments

Update comments for private fields if needed:

```typescript
// ===== Resolution layer (always up-to-date) =====
private resolutions: ResolutionRegistry = new ResolutionRegistry();
private root_folder?: FileSystemFolder = undefined;
```

**Note**: `call_graph_cache` field was removed in task 143.4, so it should not appear here.

### 5. Check Architecture Docs

Check if there are any architecture documents that mention the Project class:

```bash
# Find docs mentioning Project
grep -r "Project" packages/core/docs/ backlog/docs/ CLAUDE.md --include="*.md"
```

Update any found documents to reflect eager resolution.

**Specifically check CLAUDE.md** (project guidelines) - does it mention Project class?

**Key architecture changes to document**:
- Resolution is always eager (immediate, not lazy/pending)
- Resolution logic lives in ResolutionRegistry (not Project)
- No call graph caching (recalculated on demand)
- State is always consistent - no "pending" or "stale" data
- Simpler API - no explicit `resolve_file()` calls needed

### 6. Update README if Needed

Check `packages/core/README.md` for any Project class examples:

```bash
grep -n "Project\|resolve_file" packages/core/README.md
```

Update examples to remove `resolve_file()` calls.

## Testing

No new tests needed - this is pure documentation.

### Verification Checklist

Run these checks:

1. **No stale "pending" references**:
   ```bash
   grep -n "pending" packages/core/src/project/project.ts
   # Should only return: legitimate uses (like dependents tracking)
   ```

2. **No "lazy" references**:
   ```bash
   grep -n "lazy" packages/core/src/project/project.ts
   # Should return: 0 results
   ```

3. **No "invalidate" in comments**:
   ```bash
   grep -n "invalidate" packages/core/src/project/project.ts
   # Should only return: code that calls resolutions.remove_file()
   ```

4. **No "cache" references (except in comments about external caching)**:
   ```bash
   grep -n "cache" packages/core/src/project/project.ts
   # Should only return: documentation note about external caching in get_call_graph()
   ```

5. **Documentation is accurate**:
   - Read through class comment
   - Read through all public method comments
   - Verify they match implementation

## Success Criteria

- [ ] Class-level documentation updated
- [ ] All method documentation reviewed and updated
- [ ] All inline comments reviewed and updated
- [ ] No references to "lazy" resolution
- [ ] No references to "pending" state (except in variable names)
- [ ] No references to "invalidate" in comments
- [ ] No references to "cache" or "caching" (except note about external caching)
- [ ] Verified `call_graph_cache` field is gone (removed in 143.4)
- [ ] Documentation mentions that resolution logic lives in ResolutionRegistry
- [ ] Architecture docs updated if needed
- [ ] README updated if needed
- [ ] Documentation accurately reflects eager resolution model

## Notes

- This is the final polish task
- Good opportunity to review overall code clarity
- Check for any TODOs that are now obsolete
- Verify JSDoc comments are well-formatted

## Documentation Style Guidelines

Follow these guidelines:
- Use present tense ("resolves", not "will resolve")
- Be concise but complete
- Explain the "why", not just the "what"
- Include examples in complex methods
- Use proper JSDoc format for all public methods

## Dependencies

- **Requires**: task-epic-11.143.5 completed (all code changes done)
- **Blocks**: None (this completes the refactoring)

## Estimated Effort

- Review and updates: 0.5-0.75 hour
- Verification: 0.25-0.5 hour
- **Total**: 0.75-1.25 hours
