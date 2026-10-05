---
id: TASK-195.6
title: Integrate persistence into load_project() and add Project.save()
status: To Do
assignee: []
created_date: "2026-03-26 11:04"
labels: []
dependencies:
  - TASK-195.2
  - TASK-195.3
  - TASK-195.4
  - TASK-195.5
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Wire persistence into the loading pipeline. `LoadProjectOptions` gains `storage?: PersistenceStorage`. When provided, `load_project()` implements the warm start flow:

1. Load cache manifest from storage
2. For each discovered file: hash content, check cache, call `restore_file()` (cache hit) or `update_file()` (cache miss)
3. Skip cached files not on disk (deleted)
4. Save updated manifest + newly cached indexes

Add `Project.save(storage: PersistenceStorage)` for explicit persistence.

Error handling: any cache failure (corrupt JSON, version mismatch, missing data) logs a warning and falls back to full re-index. No errors propagate to the caller.

Export `PersistenceStorage` and `FileSystemStorage` from `packages/core/src/index.ts`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 LoadProjectOptions.storage optional parameter added
- [ ] #2 Warm start flow implemented: hash-check -> restore_file (hit) or update_file (miss)
- [ ] #3 Deleted files (in cache but not on disk) are skipped
- [ ] #4 Project.save() serializes current state to provided storage
- [ ] #5 Corrupt/invalid cache falls back to full re-index with console.warn
- [ ] #6 Without storage parameter, behavior is identical to current (no regression)
- [ ] #7 PersistenceStorage and FileSystemStorage exported from packages/core/src/index.ts
- [ ] #8 Integration test: load project, save, load again with cache, verify identical call graph
<!-- AC:END -->
