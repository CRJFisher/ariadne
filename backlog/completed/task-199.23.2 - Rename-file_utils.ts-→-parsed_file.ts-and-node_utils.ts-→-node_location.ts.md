---
id: TASK-199.23.2
title: 'Rename: file_utils.ts → parsed_file.ts and node_utils.ts → node_location.ts'
status: Done
assignee: []
created_date: '2026-04-15 10:49'
updated_date: '2026-04-15 14:04'
labels:
  - refactor
  - information-architecture
  - naming
dependencies: []
references:
  - packages/core/src/index_single_file/file_utils.ts
  - packages/core/src/index_single_file/node_utils.ts
parent_task_id: TASK-199.23
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two files in `index_single_file/` violate the naming rule from `.claude/rules/file-naming.md`: "File names describe their responsibility, not their category. Avoid `file_utils.ts` — generic, unclear purpose."

- `packages/core/src/index_single_file/file_utils.ts` — contains the `ParsedFile` type. Rename to `parsed_file.ts`.
- `packages/core/src/index_single_file/node_utils.ts` — contains `node_to_location()`. Rename to `node_location.ts`.

Use `git mv` to preserve history. Update all import paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 file_utils.ts renamed to parsed_file.ts
- [x] #2 node_utils.ts renamed to node_location.ts
- [x] #3 All imports updated
- [x] #4 All tests pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed `file_utils.ts` → `parsed_file.ts` and `node_utils.ts` → `node_location.ts` (plus their test files) using `git mv`. Updated all import paths across 43 files. Updated `describe` block names in the two test files to match. All 2628 tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
