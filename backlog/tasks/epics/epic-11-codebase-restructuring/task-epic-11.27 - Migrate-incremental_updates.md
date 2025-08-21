---
id: task-epic-11.27
title: Migrate incremental_updates feature
status: In Progress
assignee: []
created_date: "2025-08-20"
labels: [migration, data-layer, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `incremental_updates` feature to `src/project/incremental_updates/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:

- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where incremental_updates currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to incremental_updates
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how incremental_updates connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **File Tracker**: React to file changes
   - TODO: Update on file modifications
2. **Scope Tree**: Update scope incrementally
   - TODO: Rebuild affected scopes
3. **Type Tracking**: Update types incrementally
   - TODO: Recompute affected types
4. **Module Graph**: Update graph incrementally
   - TODO: Update module edges

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface IncrementalUpdater {
  update_file(path: string, content: string): UpdateResult;
  get_affected_files(path: string): string[];
}
```

## Planning Phase

### Folder Structure

- [ ] Determine if sub-folders needed for complex logic
- [ ] Plan file organization per Architecture.md patterns
- [ ] List all files to create

### Architecture Verification

- [ ] Verify against docs/Architecture.md folder patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan dispatcher/marshaler pattern

## Implementation Phase

## Implementation Plan (the how)

1. Inventory current incremental behavior in src_old and map responsibilities
2. Create `src/project/incremental_updates/` with `index.ts` and `incremental_updates.ts` stubs
3. Define minimal `IncrementalUpdater` interface and return types in `types.ts`
4. Implement no-op but wired `update_file(path, content)` and `get_affected_files(path)` with TODOs
5. Move `incremental.test.ts` to `tests/integration_tests/` and update imports if needed
6. Re-export incremental APIs from `src/index.ts`; verify type checks and tests pass
7. Document integration points with File Tracker, Scope Tree, Type Tracking, Module Graph

### Code Migration

- [ ] Create folder structure at src/project/incremental_updates/
- [ ] Move/create common incremental_updates.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create incremental_updates.test.ts
- [ ] Move/create language-specific test files
- [ ] Ensure all tests pass
- [ ] Add test contract if needed

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [ ] Comprehensive test coverage
- [ ] Follows rules/coding.md standards
- [ ] Files under 32KB limit
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `incremental_updates.ts`:

   ```typescript
   // TODO: Integration with File Tracker
   // - Update on file modifications
   // TODO: Integration with Scope Tree
   // - Rebuild affected scopes
   // TODO: Integration with Type Tracking
   // - Recompute affected types
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Module Graph - Update module edges
   ```
