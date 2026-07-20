---
id: TASK-364.9
title: >-
  Thread the known root scope id into create_processing_context and drop
  find_root_scope
status: To Do
assignee: []
created_date: '2026-07-20 21:13'
labels:
  - refactor
  - dead-code
dependencies: []
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`create_processing_context` (packages/core/src/index_single_file/scopes/scopes.ts) re-derives the root scope by scanning the scope map via the local `find_root_scope` helper, even though `build_scopes` already creates the root deterministically as `module_scope(file_location)`. Thread the known root scope id from scope construction through to `create_processing_context` so the scan becomes unnecessary, then delete `find_root_scope`.

Spun off from task-364.2, which kept `find_root_scope` as the single local owner (option a) but noted this deletion path as out of its scope.

### Work

1. Surface the root scope id from `build_scopes` (return it alongside the scope map, or pass the deterministically-known `module_scope(file_location)` from the `index_single_file.ts` orchestrator).
2. Change `create_processing_context` to accept the root scope id instead of deriving it via `find_root_scope`.
3. Update the sole call site in `index_single_file.ts`.
4. Delete `find_root_scope` from `scopes.ts` — no re-export shim.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `grep -rn "find_root_scope" packages/core/src` returns no results; the helper is gone.
- [ ] #2 `create_processing_context` receives the root scope id as an argument rather than scanning the scope map for a parent-less scope.
- [ ] #3 Behaviour unchanged; full core suite green.
<!-- AC:END -->
