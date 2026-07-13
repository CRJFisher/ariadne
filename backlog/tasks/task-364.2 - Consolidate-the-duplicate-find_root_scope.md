---
id: TASK-364.2
title: "Consolidate the duplicate find_root_scope"
status: To Do
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

- [ ] `grep -rn "find_root_scope" packages/core/src` shows exactly one function
      definition; every caller resolves to it.
- [ ] Behaviour unchanged; full core suite green.

<!-- AC:END -->
