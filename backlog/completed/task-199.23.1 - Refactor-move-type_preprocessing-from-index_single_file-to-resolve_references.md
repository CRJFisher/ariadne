---
id: TASK-199.23.1
title: >-
  Refactor: move type_preprocessing/ from index_single_file/ to
  resolve_references/
status: Done
assignee: []
created_date: "2026-04-15 10:49"
updated_date: "2026-04-15 13:50"
labels:
  - refactor
  - information-architecture
dependencies: []
references:
  - packages/core/src/index_single_file/type_preprocessing/
  - packages/core/src/resolve_references/registries/type.ts
  - packages/core/src/.claude/rules/semantic-indexing.md
parent_task_id: TASK-199.23
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The `type_preprocessing/` folder lives under `index_single_file/` but its functions are exclusively consumed by `resolve_references/registries/type.ts`. They operate on `SemanticIndex` data (indexing output) to produce intermediate maps for the resolution phase. There is already a stale TODO on line 15 of `type.ts` acknowledging this:

```typescript
from "../../index_single_file/type_preprocessing";  // TODO: move these to a folder with this module
```

Move `packages/core/src/index_single_file/type_preprocessing/` to `packages/core/src/resolve_references/type_preprocessing/` using `git mv` to preserve history. Update all import paths. Update `.claude/rules/semantic-indexing.md` module layout diagram to remove `type_preprocessing/` from the `index_single_file/` section.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 type_preprocessing/ lives at resolve_references/type_preprocessing/
- [x] #2 All imports updated — no references to the old path remain
- [x] #3 The TODO comment on type.ts line 15 is removed
- [x] #4 semantic-indexing.md module layout is updated
- [x] #5 All tests pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Moved `packages/core/src/index_single_file/type_preprocessing/` to `packages/core/src/resolve_references/type_preprocessing/` using `git mv`.

Changes:

- `resolve_references/registries/type.ts` — updated import from `../../index_single_file/type_preprocessing` to `../type_preprocessing` (the TODO was already absent from the file)
- `resolve_references/type_preprocessing/*.test.ts` (4 files) — updated `../index_single_file` and `../file_utils` imports to `../../index_single_file/index_single_file` and `../../index_single_file/file_utils` to compensate for the new directory depth
- `.claude/rules/semantic-indexing.md` — removed `type_preprocessing/` line from `index_single_file/` module layout
- `.claude/rules/resolve-references.md` — added `type_preprocessing/` section to `resolve_references/` module layout

All 99 test files / 2628 tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
