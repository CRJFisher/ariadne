---
id: TASK-364.4
title: Unify IndirectReachabilityEntry (core) with IndirectReachability (types)
status: Done
assignee: []
created_date: '2026-07-12 00:00'
updated_date: '2026-07-20 18:46'
labels:
  - dead-code
  - refactor
  - types
dependencies: []
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
- [x] #1 `IndirectReachabilityEntry` no longer exists; core uses
      `@ariadnejs/types`' `IndirectReachability`.
- [x] #2 `grep -rn "IndirectReachabilityEntry" packages` returns nothing.
- [x] #3 Full workspace suite green (core + types).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

A module-hygiene sweep left two structurally identical single-field types describing the same concept across a package boundary: core's `IndirectReachabilityEntry` and the workspace-public `IndirectReachability` in `@ariadnejs/types`, both `{ reason: IndirectReachabilityReason }` once the write-only `function_id` field was dropped. One shape carried two names — a duplicate-type smell that made the resolution state and the public `CallGraph` contract look unrelated when they are the same thing.

`@ariadnejs/types`' `IndirectReachability` is the single canonical type. It already backs the workspace-public contract (`CallGraph.indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>`), so promoting it and deleting the core duplicate collapses the two names onto the type the rest of the system already reads. There is no bridging alias: every core producer, consumer, and test now imports the type directly from `@ariadnejs/types`.

`detect_indirect_reachability` now produces `Map<SymbolId, IndirectReachability>`; `ResolutionState` and `ResolutionRegistry` store and return the same type; the ~18 test literals across `indirect_reachability.test.ts` and `resolution_state.test.ts` are re-typed to it.

To navigate the result: the canonical type lives in `packages/types/src/call_graph.ts` alongside `IndirectReachabilityReason` and the `CallGraph` contract it feeds. Core's `indirect_reachability.ts` is the producer, `resolution_state.ts` holds it in immutable state, and `resolution_registry.ts` exposes it via `get_indirect_reachability()`.

What to know: the canonical type marks `reason` `readonly` (stricter than the deleted mutable core version), which is safe because every site constructs a fresh entry via `map.set(id, { reason })` or reads `entry.reason` — none reassigns. The task Description's locator points at `packages/types/src/call_chains.ts:62`; the type's current home is `packages/types/src/call_graph.ts` after a types-package reorganization.

Verification: build, typecheck (all packages), and lint green; `@ariadnejs/types` (131) and `@ariadnejs/core` (3417) suites pass; `grep -rn "IndirectReachabilityEntry" packages` returns nothing.
<!-- SECTION:NOTES:END -->
