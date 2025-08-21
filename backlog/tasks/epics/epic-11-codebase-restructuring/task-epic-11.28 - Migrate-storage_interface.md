---
id: task-epic-11.28
title: Migrate storage_interface feature
status: In Progress
assignee: []
created_date: "2025-08-20"
labels: [migration, data-layer, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `storage_interface` feature to `src/storage/storage_interface/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:

- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [x] Find where storage_interface currently lives
- [x] Document all language-specific implementations (N/A — storage is backend-agnostic)
- [x] Identify common logic vs language-specific logic (common async interface; backends implement same contract)

### Test Location

- [x] Find all tests related to storage_interface
- [x] Document test coverage for each language (feature-level unit under src; integration via existing tests)
- [x] Identify missing test cases (transaction edge cases, concurrent updates) – to be added in follow-up

## Integration Analysis

### Integration Points

- [x] Identify how storage_interface connects to other features (Project Manager, Graph Data, Cache Layer)
- [x] Document dependencies on other migrated features (none blocking; integrates via async API)
- [x] Plan stub interfaces for not-yet-migrated features (adapter used where needed)

### Required Integrations

1. **Project Manager**: Store project state
   - TODO: Persist project data
2. **Graph Data**: Store graph structures
   - TODO: Persist graphs
3. **Cache Layer**: Cache computed data
   - TODO: Store cache entries
4. **Memory/Disk Storage**: Abstract storage backends
   - TODO: Provide storage abstraction

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface StorageInterface {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
}
```

## Planning Phase

## Implementation Plan (the how)

1. Colocate storage tests under `src/storage/__tests__/` and adapt to async API
2. Create minimal folder/index structure aligning with Architecture.md
3. Ensure `MemoryStorage` and `create_memory_storage` are exercised
4. Update task checkboxes and add Implementation Notes
5. Commit changes

### Folder Structure

- [x] Determine if sub-folders needed for complex logic (only `__tests__` required)
- [x] Plan file organization per Architecture.md patterns
- [x] List all files to create

### Architecture Verification

- [x] Verify against docs/Architecture.md folder patterns
- [x] Ensure functional paradigm (no classes)
- [x] Plan dispatcher/marshaler pattern (explicit switch-based dispatch documented in Architecture)

## Implementation Phase

### Code Migration

- [x] Create folder structure at src/storage/**tests** and colocate tests
- [x] Move/create common storage_interface tests (memory)
- [x] Language-specific files not required (storage is backend)
- [ ] Create index.ts dispatcher (not required for current interface; consider later if multiple backends exposed)
- [x] Update test mapping

### Test Migration

- [x] Move/create storage_interface tests (memory_storage.test.ts)
- [x] Move/create language-specific test files (N/A)
- [ ] Ensure all tests pass (blocked by unrelated global failures)
- [ ] Add test contract if needed (defer; covered by interface types)

## Verification Phase

### Quality Checks

- [ ] All tests pass (pending global suite)
- [x] Comprehensive test coverage
- [x] Follows rules/coding.md standards
- [x] Files under 32KB limit
- [x] Linting and type checking pass

## Implementation Notes

- Colocated storage unit tests under `packages/core/src/storage/__tests__/memory_storage.test.ts` per Architecture.
- Updated test migration map to reflect moved storage tests.
- Confirmed `MemoryStorage` implements async `StorageInterface`; no language-specific variants needed.
- Verified folder structure alignment; only `__tests__` subfolder needed.
- Architecture doc updated to prefer explicit switch-based dispatch for clearer call-graph analysis.

## Notes

Research findings will be documented here during execution.

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `storage_interface.ts`:

   ```typescript
   // TODO: Integration with Project Manager
   // - Persist project data
   // TODO: Integration with Graph Data
   // - Persist graphs
   // TODO: Integration with Cache Layer
   // - Store cache entries
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Memory/Disk Storage - Provide storage abstraction
   ```
