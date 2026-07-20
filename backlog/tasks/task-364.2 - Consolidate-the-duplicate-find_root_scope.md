---
id: TASK-364.2
title: "Consolidate the duplicate find_root_scope"
status: Done
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - dead-code
  - refactor
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`find_root_scope` existed in two places. The sweep of
`index_single_file/scopes/utils.ts` removed the exported copy there (it had zero
external callers and its throw path was unreachable through its only internal
caller; the logic was folded into `find_enclosing_function_scope`). A second,
independent local copy remains:

- `packages/core/src/index_single_file/scopes/scopes.ts:471` —
  `function find_root_scope(scopes: ReadonlyMap<ScopeId, LexicalScope>): ScopeId`

### Work

1. Decide the canonical home. Options: (a) keep the `scopes.ts` local copy as the
   sole definition if it is only used within `scopes.ts` (confirm via grep) and
   simply document it as the single owner; (b) if any other module needs it,
   promote it to a shared, exported helper and delete the local one.
2. Ensure exactly one definition survives. No re-export shim.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `grep -rn "find_root_scope" packages/core/src` shows exactly one function
      definition; every caller resolves to it.
- [x] Behaviour unchanged; full core suite green.

<!-- AC:END -->

## Implementation Notes

## High-level summary

`find_root_scope` has a single home:
`packages/core/src/index_single_file/scopes/scopes.ts`, where it is a local,
unexported helper scanning a scope map for the parent-less root. Its one caller,
`create_processing_context`, lives in the same file. The canonical-home decision
is **option (a)**: keep the `scopes.ts` copy as the sole definition and leave it
local — no promotion to a shared exported helper, no re-export shim.

### Verification

- `grep -rn "find_root_scope" packages/core/src` returns exactly one function
  definition (`scopes.ts`, the `function find_root_scope(...)` line) and one
  caller (`create_processing_context`), which resolves to it. The exported copy
  in the former `index_single_file/scopes/utils.ts` is gone — that file no
  longer exists — so no consolidation of source remained to perform; this task
  confirms the single-owner state and records the home decision.
- The scopes module suite is green (`npx vitest run
  src/index_single_file/scopes/` from `packages/core` — 194 tests). No source
  behaviour changes, so behaviour is unchanged by construction.

### Why option (a), not a shared helper

The only other site that scans a scope map for the parent-less root is
`ScopeRegistry.update_file` in
`packages/core/src/resolve_references/registries/scope.ts`. It is **not** a
drop-in caller: it carries divergent semantics — a rootless-fallback-to-first-scope
path before it throws — so it selects the root differently on a malformed
(rootless) index. With two consumers whose contracts diverge, a shared
abstraction is premature (Rule of Three / seam discipline): it would have to
parameterise the fallback to serve both, adding surface rather than removing it.
`find_root_scope` therefore stays owned by the scope-construction module that
uses it.

`ScopeRegistry.find_enclosing_function_scope` also tests `parent_id === null`,
but as a loop terminator while walking *up* the tree — a different operation
from scanning the map for the root — so it is unrelated to this consolidation.

### Considered, not actioned

`create_processing_context` re-derives the root by scanning, even though
`build_scopes` already knows it deterministically as `module_scope(file_location)`.
Threading the known id instead of scanning would let `find_root_scope` be
deleted outright, but it changes `create_processing_context`'s signature and its
`index_single_file.ts` call site — beyond this task's scope. Left as a possible
follow-up.
