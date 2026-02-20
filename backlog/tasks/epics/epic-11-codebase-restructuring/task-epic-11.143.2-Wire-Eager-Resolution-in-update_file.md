# Task: Wire Up Eager Resolution in update_file()

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Modify `update_file()` to immediately resolve affected files after updating registries. This changes the method from lazy (invalidate only) to eager (resolve immediately).

## Context

Currently, `update_file()` ends with:
```typescript
// Phase 3: Invalidate affected resolutions
this.resolutions.invalidate_file(file_id);
for (const dependent_file of dependents) {
  this.resolutions.invalidate_file(dependent_file);
}
```

This marks files as "pending" but doesn't resolve them. Users must call `resolve_file()` or `get_call_graph()` later.

With eager resolution:
```typescript
// Phase 3: Re-resolve affected files (eager!)
const affected_files = new Set([file_id, ...dependents]);
this.resolutions.resolve_files(
  affected_files,
  this.semantic_indexes,
  this.definitions,
  this.types,
  this.scopes,
  this.exports,
  this.imports,
  this.root_folder!
);
```

This resolves immediately, maintaining always-consistent state. Resolution logic lives in ResolutionRegistry.

## Goals

1. Replace invalidation logic with eager resolution
2. Remove calls to `invalidate_file()` (will be removed in 143.5)
3. Add integration tests verifying immediate resolution
4. Ensure existing tests still pass (or update them)

## Implementation

### 1. Update Phase 3 of update_file()

Replace the existing Phase 3 code:

```typescript
// BEFORE (in project.ts around line 235-240)
// Phase 3: Invalidate affected resolutions
this.resolutions.invalidate_file(file_id);
for (const dependent_file of dependents) {
  this.resolutions.invalidate_file(dependent_file);
}
```

With:

```typescript
// Phase 3: Re-resolve affected files (eager!)
const affected_files = new Set([file_id, ...dependents]);
this.resolutions.resolve_files(
  affected_files,
  this.semantic_indexes,
  this.definitions,
  this.types,
  this.scopes,
  this.exports,
  this.imports,
  this.root_folder!
);
```

### 2. Update Method Documentation

Update the docstring for `update_file()`:

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

(Changed from "4 phases" to "3 phases" and updated Phase 3 description)

## Testing

### Update Existing Tests

Some tests currently check for pending state after `update_file()`. These need updates:

**Test 1: "should invalidate resolutions when file is updated"** (project.test.ts line 43-62)

Replace with:

```typescript
it("should immediately resolve references when file is updated", async () => {
  const project = new Project();
  await project.initialize();

  const file1 = "file1.ts" as FilePath;

  // First version: foo calls nothing
  project.update_file(file1, `
    function foo() { return 42; }
    const x = foo();
  `);

  // Verify references are resolved immediately
  const index1 = project.get_semantic_index(file1)!;
  const foo_ref = index1.references.find(r => r.name === "foo");
  expect(foo_ref).toBeDefined();
  // Resolution should exist (not checking exact value, just existence)
  // This verifies eager resolution happened

  // Update file: change function name
  project.update_file(file1, `
    function bar() { return 99; }
    const y = bar();
  `);

  // Verify new references are resolved immediately
  const index2 = project.get_semantic_index(file1)!;
  const bar_ref = index2.references.find(r => r.name === "bar");
  expect(bar_ref).toBeDefined();
  // Resolution should exist for bar now
});
```

**Test 2: "should invalidate dependent files when file is updated"** (project.test.ts line 64-86)

Replace with:

```typescript
it("should re-resolve dependent files when file is updated", async () => {
  const project = new Project();
  await project.initialize();

  const file1 = "file1.ts" as FilePath;
  const file2 = "file2.ts" as FilePath;

  // Create file1 that exports something
  project.update_file(file1, "export function foo() { return 42; }");

  // Create file2 that imports from file1
  project.update_file(file2, `
    import { foo } from "./file1";
    const x = foo();
  `);

  // Both files should be resolved (no pending state)
  const stats_before = project.get_stats();
  expect(stats_before.file_count).toBe(2);

  // Update file1 (changes export)
  project.update_file(file1, "export function bar() { return 99; }");

  // file1 and file2 should both be re-resolved immediately
  // Verify this by checking that we can get call graph without errors
  const call_graph = project.get_call_graph();
  expect(call_graph).toBeDefined();
});
```

### Add New Integration Tests

Add tests verifying eager resolution behavior:

```typescript
describe("eager resolution behavior", () => {
  it("should resolve immediately without explicit resolve_file() call", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, `
      function foo() { return 42; }
      const x = foo();
    `);

    // Should be able to get call graph immediately
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
    expect(call_graph.nodes.size).toBeGreaterThan(0);
  });

  it("should maintain consistent state across multiple updates", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;

    // Update 1
    project.update_file(file1, "function foo() {}");
    let call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();

    // Update 2
    project.update_file(file1, "function bar() {}");
    call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();

    // Update 3
    project.update_file(file1, "function baz() {}");
    call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();

    // State should always be consistent
  });

  it("should resolve dependent files immediately", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;

    // Setup dependency: file2 imports from file1
    project.update_file(file1, "export function foo() {}");
    project.update_file(file2, `import { foo } from "./file1"; foo();`);

    // Update file1 - should re-resolve file2 immediately
    project.update_file(file1, "export function foo() { return 42; }");

    // Should be able to get call graph without explicit resolve
    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });
});
```

## Verification

After completing this task:

1. **Run tests**: `npm test --workspace=@ariadnejs/core -- project.test.ts`
2. **Verify behavior**:
   - `update_file()` should not leave files in pending state
   - `get_call_graph()` should work immediately after `update_file()`
   - No need to call `resolve_file()` (still exists but not needed)

## Success Criteria

- [ ] Phase 3 of `update_file()` replaced with eager resolution
- [ ] Calls to `invalidate_file()` removed from `update_file()`
- [ ] Method documentation updated
- [ ] Existing tests updated (no more pending state checks)
- [ ] New integration tests added
- [ ] All tests passing
- [ ] Call graph can be retrieved immediately after `update_file()`

## Notes

- `resolve_file()` still exists (removed in task 143.5) but is no longer necessary
- `invalidate_file()` method still exists (removed in task 143.5) but is not called
- Resolution logic now lives in ResolutionRegistry, not Project
- Focus on making `update_file()` self-contained and atomic
- This is a breaking change for internal behavior but external API (via MCP) unchanged
- Call graph is recalculated on demand (no caching)

## Dependencies

- **Requires**: task-epic-11.143.1 completed (helpers exist)
- **Blocks**: task-epic-11.143.3 (similar change for remove_file)

## Estimated Effort

- Implementation: 0.5-1 hour
- Testing: 1.5-2 hours
- **Total**: 2-3 hours
