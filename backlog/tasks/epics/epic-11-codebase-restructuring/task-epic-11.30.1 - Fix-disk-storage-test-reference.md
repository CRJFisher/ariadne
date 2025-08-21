---
id: task-epic-11.30.1
title: Fix broken disk storage test reference
status: To Do
assignee: []
created_date: "2025-08-21"
labels: [migration, data-layer, epic-11, bug-fix]
dependencies: [task-epic-11.30]
parent_task_id: task-epic-11.30
---

## Description

Fix the broken reference in `tests/storage_interface.test.ts` that expects a disk storage example provider at `src/storage/examples/disk_storage.ts`.

## Context

During the migration of disk_storage (task-epic-11.30), we discovered that `tests/storage_interface.test.ts` has a reference to a non-existent example disk storage provider. The test file imports from `'../src/storage/examples/disk_storage'` but this file doesn't exist.

## Tasks

- [ ] Review `tests/storage_interface.test.ts` to understand the expected example provider
- [ ] Determine if the example provider should be created or if the test should be updated
- [ ] Either:
  - Create the example provider at the expected location, OR
  - Update the test to remove the broken reference, OR
  - Update the test to use the actual disk_storage implementation
- [ ] Ensure all storage interface tests pass

## Acceptance Criteria

- [ ] No broken imports in `tests/storage_interface.test.ts`
- [ ] All storage interface tests pass
- [ ] Decision documented on whether to keep example providers or use actual implementations
