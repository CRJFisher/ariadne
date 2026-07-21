---
id: TASK-364.9
title: >-
  Thread the known root scope id into create_processing_context and drop
  find_root_scope
status: Done
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
- [x] #1 `grep -rn "find_root_scope" packages/core/src` returns no results; the helper is gone.
- [x] #2 `create_processing_context` receives the root scope id as an argument rather than scanning the scope map for a parent-less scope.
- [x] #3 Behaviour unchanged; full core suite green.
<!-- AC:END -->

## Implementation Notes

## High-level summary

The root scope id flows from scope construction directly into the processing context, so the context no longer recomputes it. `process_scopes` returns `{ scopes, root_scope_id }`, where `root_scope_id` is the deterministically-built `module_scope(file_location)` root it already creates as the file's parent-less module scope. `create_processing_context` takes that id as a parameter and uses it as the depth-precomputation seed and the `ProcessingContext.root_scope_id`. Threading the known value makes the single source of the root id its point of construction.

### What changed

- `process_scopes` (`packages/core/src/index_single_file/scopes/scopes.ts`) returns `{ scopes: ReadonlyMap<ScopeId, LexicalScope>; root_scope_id: ScopeId }` instead of a bare map, surfacing the root it already constructs.
- `create_processing_context` gains a `root_scope_id: ScopeId` parameter (signature `(scopes, root_scope_id, captures)`) and consumes it directly.
- The sole orchestrator call site in `index_single_file.ts` destructures `{ scopes, root_scope_id }` and threads the id through.
- `find_root_scope` — the parent-less-scope scan — is deleted from `scopes.ts` with no re-export shim.

### How the acceptance criteria are met

- **#1** — `find_root_scope` is removed; a repo-wide grep over `packages/core/src` returns no results.
- **#2** — `create_processing_context` receives the root scope id as its second argument; the map scan is gone.
- **#3** — Behaviour is unchanged. The threaded id is provably identical to the scan's result: `process_scopes` creates exactly one parent-less scope (the `module_scope(file_location)` root, inserted first), and every other scope is assigned a non-null parent from `find_containing_scope`. Full core suite green (3317 passing; the sole non-passing test is an unrelated load-sensitive timeout in `persistence.test.ts` that passes in isolation). Typecheck and lint clean.

### Tests

The five `create_processing_context` cases in `scopes.test.ts` pass the root id explicitly and keep asserting `scope_depths` and `get_scope_id` outputs; the malformed-tree case (two parent-less scopes) passes the first-inserted scope as the seed, preserving its depth-collision throw. The `process_scopes` cases destructure `{ scopes }`. End-to-end coverage through `build_index_single_file → process_scopes → create_processing_context` pins the threaded root via `SemanticIndex.root_scope_id` in the serialization and definition-builder tests.
