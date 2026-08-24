---
id: TASK-381.5
title: "Evict a batch of files from resolution state in one pass instead of once per file"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - call-resolution
  - memory
dependencies:
  - TASK-381.4
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`ResolutionRegistry.resolve_names` evicts one file at a time — `packages/core/src/resolve_references/resolution_registry.ts:67-68` loops `file_ids` calling `remove_file` from `packages/core/src/resolve_references/resolution_state.ts:157` — and each call scans all of `state.scope_to_file` (`:162`), clones four project-wide Maps (`:169` onward), deletes from `resolved_calls_by_file` and prunes `indirect_reachability`. A 190-file batch therefore pays 190 whole-project scans and 190 sets of clones to remove 190 files.

The decisive control was two files at 63,205 project scopes: a 378-byte file holding 2 scopes costs 51.17 ms to evict and a 633 KB file holding 1,870 scopes costs 51.44 ms — 0.5% apart for a 936x difference in the input. The cost tracks project scope count (R^2 = 0.9988 against it), not the file being removed. Set-wise batching cuts cloned Map entries 78-80x (45.2M to 565K at n=1,200) and the eviction term itself 45-56x, output-neutral. Its whole-load effect is modest and has been overstated: 1.032x at n=600, inside that arm's own 2.29% run-to-run CV, and 1.076x at n=1,200. Land it for the allocation volume, not for the ratio. Note also that 45.2M cloned entries at n=1,200 is the measurement that refutes the standing claim that these are clones of empty maps.

The identity-return fast path is the correctness hazard. `remove_file` touches five structures, not one: a batch that removes no scope may still remove a `resolved_calls_by_file` entry or an `indirect_reachability` entry. An implementation that checks only the scope scan will silently drop those evictions and move the call graph, so the predicate must cover all five.

## Explicitly not in scope

Making `ResolutionState` mutable. A full-corpus profile put the copy-on-write family at 27% of the run (211 s), and that reading was used to argue for abandoning the module's immutability contract — the largest-effort proposal anyone made. Direct attribution refutes it: that cost lives inside the export-gate rollback path (TASK-381.8), while the two-phase corpus batch's own `ResolutionState` work is 24.0 s, 2.9% of the load. Repair the gate and the bulk-load cost evaporates without touching the contract. Revisit only if a long-running incremental MCP session — thousands of single-file edits against a large state — is profiled and shows the same term, which nobody has yet done.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `ResolutionRegistry.resolve_names` calls a single `remove_files(state, file_ids)` that scans `scope_to_file` once per batch, and no per-file eviction loop remains on the bulk path.
- [ ] #2 #2 `remove_files` returns the identical state object only when the batch removes no scope from `scope_to_file`, no entry from `resolved_calls_by_file` and no entry from `indirect_reachability` — all five structures `remove_file` touches, not the scope scan alone — so no clone is allocated in that case (measured 91-95% of cold-load evictions). A test asserts identity is NOT returned when only a `resolved_calls_by_file` entry is affected.
- [ ] #3 #3 Cloned Map entries over a 1,200-file load fall from 45.2M to <= 1M; the prototype measured 565K.
- [ ] #4 #4 The six-number fingerprint is unchanged at n=200, 600 and 1,200.
- [ ] #5 #5 `ResolutionState`'s copy-on-write contract is unchanged, and the module records the conclusion plus a pointer — that the copy-on-write share attributed to it by profiling belongs to the export-gate rollback path rather than to bulk load, citing the TASK-381.7 harness row that measured it — so the mutable redesign is not re-proposed from a profile alone. The raw seconds live in the harness, not in a doc comment that will rot.
- [ ] #6 #6 `resolution_state.test.ts` stays green, including the eviction tests written against the per-file shape.

<!-- AC:END -->
