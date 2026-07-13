---
id: TASK-364.4
title: "Unify IndirectReachabilityEntry (core) with IndirectReachability (types)"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - dead-code
  - refactor
  - types
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The `indirect_reachability.ts` sweep removed a write-only `function_id` field
(it duplicated the map key and was never read in production) from two structural
twins:

- `packages/core/src/resolve_references/indirect_reachability.ts:17` —
  `interface IndirectReachabilityEntry`
- `packages/types/src/call_chains.ts:62` — `interface IndirectReachability`

After that removal both are now identical single-field wrappers:
`{ readonly reason: IndirectReachabilityReason }`. Two names for the same shape,
one in `@ariadnejs/core` and one in `@ariadnejs/types` — a duplicate-type smell.
Unifying them is a cross-package change, out of scope for the single-module
sweep.

### Work

1. Make `@ariadnejs/types`' `IndirectReachability` the single canonical type
   (it is the workspace-public type, referenced by `CallChain`-family contracts
   via `indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>`).
2. Delete `IndirectReachabilityEntry` from core; have
   `indirect_reachability.ts` produce and consume `IndirectReachability` from
   `@ariadnejs/types` directly.
3. Update the ~10 test literals in `resolution_state.test.ts` and any other
   references. No re-export alias bridging the two names.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `IndirectReachabilityEntry` no longer exists; core uses
      `@ariadnejs/types`' `IndirectReachability`.
- [ ] `grep -rn "IndirectReachabilityEntry" packages` returns nothing.
- [ ] Full workspace suite green (core + types).

<!-- AC:END -->
