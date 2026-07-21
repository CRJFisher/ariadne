# Task: Add Helper Methods to Project

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: High
**Complexity**: Low

## Overview

Verify that ResolutionRegistry's new `resolve_files()` method (added in task-epic-11.142) works correctly when called from Project class. This is a verification/testing task - no new methods are added to Project.

**Important**: The resolution logic lives in ResolutionRegistry, not Project. This task just verifies integration.

## Context

Task-epic-11.142 added `resolve_files()` method to ResolutionRegistry. This method encapsulates the entire resolution pipeline:

1. Call `resolve_symbols()` with all registries
2. Convert output from LocationKey → ReferenceId format (via `group_resolutions_by_file()`)
3. Update resolutions for affected files

Now we need to verify that Project can successfully call this method and that integration works correctly.

## Goals

1. Write integration tests that call `resolutions.resolve_files()` from Project context
2. Verify all required registries are passed correctly
3. Ensure no behavior changes in existing tests
4. Verify Project has access to all needed dependencies

## Implementation

### 1. Verify Project Has Required Fields

Check that Project class has all fields needed to call `resolutions.resolve_files()`:

```typescript
// Required fields (should already exist):
private semantic_indexes: Map<FilePath, SemanticIndex>;
private definitions: DefinitionRegistry;
private types: TypeRegistry;
private scopes: ScopeRegistry;
private exports: ExportRegistry;
private imports: ImportGraph;
private root_folder?: FileSystemFolder;
```

All these should already exist in Project class. Just verify.

### 2. No Code Changes Needed

This task is primarily about verification. The actual `resolve_files()` method lives in ResolutionRegistry (added in task-epic-11.142).

Project will call it like this (in next tasks):

```typescript
// In update_file() or remove_file():
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

### 3. Verify No Behavior Changes

Run existing tests to ensure nothing broke:

```bash
npm test --workspace=@ariadnejs/core -- project.test.ts
```

All tests should still pass (no behavior changes yet).

## Testing

### Integration Tests for ResolutionRegistry.resolve_files()

Add tests to verify the integration works:

```typescript
describe("ResolutionRegistry.resolve_files() integration", () => {
  it("should resolve files when called from Project context", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, `
      function foo() { return 42; }
      const x = foo();
    `);

    // Access resolutions registry
    const resolutions = (project as any).resolutions;

    // Call resolve_files directly
    const affected_files = new Set([file1]);
    resolutions.resolve_files(
      affected_files,
      (project as any).semantic_indexes,
      (project as any).definitions,
      (project as any).types,
      (project as any).scopes,
      (project as any).exports,
      (project as any).imports,
      (project as any).root_folder
    );

    // Verify resolutions were updated
    const stats = resolutions.get_stats();
    expect(stats.total_resolutions).toBeGreaterThan(0);
  });

  it("should handle multiple files", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    const file2 = "file2.ts" as FilePath;
    project.update_file(file1, "export function foo() {}");
    project.update_file(file2, `import { foo } from "./file1"; foo();`);

    const resolutions = (project as any).resolutions;
    const affected_files = new Set([file1, file2]);

    resolutions.resolve_files(
      affected_files,
      (project as any).semantic_indexes,
      (project as any).definitions,
      (project as any).types,
      (project as any).scopes,
      (project as any).exports,
      (project as any).imports,
      (project as any).root_folder
    );

    // Should successfully resolve both files
    const stats = resolutions.get_stats();
    expect(stats.files_with_resolutions).toBe(2);
  });

  it("should throw if root_folder not initialized", () => {
    const project = new Project();
    // Don't call initialize()

    project.update_file("file1.ts" as FilePath, "function foo() {}");

    const resolutions = (project as any).resolutions;
    const affected_files = new Set(["file1.ts" as FilePath]);

    // Should throw when root_folder is undefined
    expect(() => {
      resolutions.resolve_files(
        affected_files,
        (project as any).semantic_indexes,
        (project as any).definitions,
        (project as any).types,
        (project as any).scopes,
        (project as any).exports,
        (project as any).imports,
        undefined // root_folder is undefined!
      );
    }).toThrow();
  });
});
```

## Success Criteria

- [ ] Verified Project has all required fields for calling `resolutions.resolve_files()`
- [ ] Integration tests added showing successful calls from Project context
- [ ] All new tests passing
- [ ] All existing tests still passing (no behavior changes)
- [ ] Confirmed ResolutionRegistry can access all needed registries

## Notes

- NO code changes to Project class in this task
- The resolution logic lives in ResolutionRegistry (added in task-epic-11.142)
- This task is about verification and testing integration
- Next sub-task (143.2) will wire this up in `update_file()`

## Dependencies

- **Requires**: task-epic-11.142 completed (ResolutionRegistry exists)
- **Blocks**: task-epic-11.143.2 (needs these helpers)

## Estimated Effort

- Verification: 0.5 hour
- Testing: 1-1.5 hours
- **Total**: 1.5-2 hours
