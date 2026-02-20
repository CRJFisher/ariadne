# Task: Wire Up Eager Resolution in remove_file()

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: High
**Complexity**: Low

## Overview

Modify `remove_file()` to immediately re-resolve dependent files after removal. This ensures dependent files are updated when an imported file is deleted.

## Context

Currently, `remove_file()` ends with:
```typescript
// Invalidate resolutions
this.resolutions.remove_file(file_id);
for (const dependent_file of dependents) {
  this.resolutions.invalidate_file(dependent_file);
}
```

This removes resolutions for the deleted file and marks dependents as pending. But dependent files still reference the deleted file - their resolutions are stale until explicit re-resolution.

With eager resolution:
```typescript
// Remove resolutions for deleted file
this.resolutions.remove_file(file_id);

// Re-resolve dependent files (they may have broken imports now)
if (dependents.size > 0) {
  this.resolutions.resolve_files(
    dependents,
    this.semantic_indexes,
    this.definitions,
    this.types,
    this.scopes,
    this.exports,
    this.imports,
    this.root_folder!
  );
}
```

## Goals

1. Add eager resolution for dependents after file removal
2. Remove `invalidate_file()` calls
3. Add integration tests
4. Ensure existing tests still pass

## Implementation

### 1. Update remove_file() Method

Replace the existing invalidation logic:

```typescript
// BEFORE (in project.ts around line 263-268)
// Invalidate resolutions
this.resolutions.remove_file(file_id);
for (const dependent_file of dependents) {
  this.resolutions.invalidate_file(dependent_file);
}
```

With:

```typescript
// Remove resolutions for deleted file
this.resolutions.remove_file(file_id);

// Re-resolve dependent files (imports may be broken now)
if (dependents.size > 0) {
  this.resolutions.resolve_files(
    dependents,
    this.semantic_indexes,
    this.definitions,
    this.types,
    this.scopes,
    this.exports,
    this.imports,
    this.root_folder!
  );
}
```

### 2. Update Method Documentation

Update the docstring for `remove_file()`:

```typescript
/**
 * Remove a file from the project completely.
 * Removes all file-local data, registry entries, and resolutions.
 * Re-resolves dependent files to update their import resolutions.
 *
 * @param file_id - The file to remove
 */
```

## Testing

### Update Existing Tests

Check if `project.test.ts` has tests for `remove_file()` that need updates.

Current test (lines 89-100) should still pass:

```typescript
describe("remove_file", () => {
  it("should remove all data for a file", () => {
    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, "function foo() {}");

    expect(project.get_file_definitions(file1).length).toBe(1);

    project.remove_file(file1);

    expect(project.get_file_definitions(file1).length).toBe(0);
    expect(project.get_all_files()).not.toContain(file1);
  });
});
```

This test should continue to pass without changes.

### Add New Integration Tests

Add tests for dependent file resolution:

```typescript
describe("remove_file with dependents", () => {
  it("should re-resolve dependent files after removal", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;

    // Setup: file2 imports from file1
    project.update_file(file1, "export function foo() { return 42; }");
    project.update_file(file2, `import { foo } from "./file1"; foo();`);

    // Verify both files exist
    expect(project.get_all_files()).toContain(file1);
    expect(project.get_all_files()).toContain(file2);

    // Remove file1
    project.remove_file(file1);

    // file1 should be gone
    expect(project.get_all_files()).not.toContain(file1);

    // file2 should still exist
    expect(project.get_all_files()).toContain(file2);

    // file2 should be re-resolved (import is now broken, but resolution attempted)
    // Verify we can get call graph without errors
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });

  it("should handle removal of file with multiple dependents", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;
    const file3 = "file3.ts" as FilePath;

    // Setup: file2 and file3 both import from file1
    project.update_file(file1, "export function foo() {}");
    project.update_file(file2, `import { foo } from "./file1";`);
    project.update_file(file3, `import { foo } from "./file1";`);

    // Get dependents before removal
    const dependents = project.get_dependents(file1);
    expect(dependents.size).toBe(2);

    // Remove file1
    project.remove_file(file1);

    // Both dependents should be re-resolved
    // Verify by checking call graph
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });

  it("should handle removal of file with no dependents", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;

    // Setup: standalone file (no dependents)
    project.update_file(file1, "function foo() {}");

    // Remove file1
    project.remove_file(file1);

    // Should not throw (no dependents to resolve)
    expect(project.get_all_files()).not.toContain(file1);

    // Call graph should still work
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });
});
```

## Verification

After completing this task:

1. **Run tests**: `npm test --workspace=@ariadnejs/core -- project.test.ts`
2. **Verify behavior**:
   - `remove_file()` should re-resolve dependents immediately
   - `get_call_graph()` should work after removing files
   - No pending state for dependents

## Success Criteria

- [ ] `remove_file()` calls `resolve_files()` for dependents
- [ ] Calls to `invalidate_file()` removed from `remove_file()`
- [ ] Method documentation updated
- [ ] New integration tests added
- [ ] All tests passing
- [ ] Dependent files are re-resolved after file removal

## Notes

- Removing a file may break imports in dependents, but we still attempt resolution
- Resolution may result in unresolved references (expected behavior)
- The key is that we attempt re-resolution immediately, maintaining consistency
- This is simpler than `update_file()` because we only need to resolve dependents (not the removed file)
- Resolution logic lives in ResolutionRegistry
- Call graph is recalculated on demand (no caching)

## Dependencies

- **Requires**: task-epic-11.143.2 completed (update_file wired up)
- **Blocks**: task-epic-11.143.4 (simplify get_call_graph)

## Estimated Effort

- Implementation: 0.5 hour
- Testing: 1-1.5 hours
- **Total**: 1.5-2 hours
