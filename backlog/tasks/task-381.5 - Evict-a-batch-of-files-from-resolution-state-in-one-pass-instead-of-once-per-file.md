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

## Where the cost turned out to be, on landed code

The bulk load no longer pays this at all, and the measurement that says so is the same counter the 45.2M came from. With the two-phase driver in place, `resolve_names` runs once after every file is in the registries, so the batch it evicts has resolved nothing: at n=200, 600 and 1,200 of `src` the cold-load evictions clone zero entries under either shape. What batching removes there is the loop — 1,200 calls and 6,000 empty-map allocations become 56 calls and none.

The 208x is on the incremental path, which is where a fully resolved project is the thing being evicted against. One edit to `src/vs/editor/common/core/range.ts` at 1,200 files re-resolves 252 files: 11,340,237 entries scanned and 28,545,624 cloned one file at a time, against 54,684 and 136,729 as a batch. That is the same shape of cost the profile attributes to the export-gate rollback, and it is what makes this the right algorithm to hold while TASK-381.8 removes the rollbacks themselves.

## Explicitly not in scope

Making `ResolutionState` mutable. A full-corpus profile put the copy-on-write family at 27% of the run (211 s), and that reading was used to argue for abandoning the module's immutability contract — the largest-effort proposal anyone made. Direct attribution refutes it: that cost lives inside the export-gate rollback path (TASK-381.8), while the two-phase corpus batch's own `ResolutionState` work is 24.0 s, 2.9% of the load. Repair the gate and the bulk-load cost evaporates without touching the contract. Revisit only if a long-running incremental MCP session — thousands of single-file edits against a large state — is profiled and shows the same term, which nobody has yet done.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `ResolutionRegistry.resolve_names` calls a single `remove_files(state, file_ids)` that scans `scope_to_file` once per batch, and no per-file eviction loop remains on the bulk path.
- [ ] #2 #2 `remove_files` returns the identical state object only when the batch removes no scope from `scope_to_file`, no entry from `resolved_calls_by_file` and no entry from `indirect_reachability` — all five structures `remove_file` touches, not the scope scan alone — so no clone is allocated in that case (measured 91-95% of cold-load evictions). A test asserts identity is NOT returned when only a `resolved_calls_by_file` entry is affected. The 91-95% share is REFUTED and replaced. MEASURED on landed code over `src`: every cold-load eviction returns the identical state — 14 of 14 at n=200, 29 of 29 at n=600, 56 of 56 at n=1,200 — because the two-phase driver resolves once after every file is in the registries, so the batch it evicts has resolved nothing yet. The 91-95% came from a stack whose export-gate rollback re-resolved mid-load. Both single-structure cases carry a test: `resolved_calls_by_file` alone and `indirect_reachability` alone.
- [ ] #3 #3 Cloned Map entries over a 1,200-file load fall from 45.2M to <= 1M; the prototype measured 565K. The 45.2M before-figure is REFUTED for the landed tree and replaced. MEASURED at n=1,200 of `src`: a cold load clones ZERO map entries under BOTH shapes, every eviction running against a state that holds nothing; what falls is the allocation itself — 6,000 empty maps to none — and the call count, 1,200 to 56. The 45.2M was the prototype's arm B, which still routed the export-gate rollback through `Project.remove_file` and so called `resolve_names` 43 times at n=1,200 against once today; TASK-381.4 removed it. The cost the batch actually removes now lives on the incremental path: at 1,200 files one edit to `src/vs/editor/common/core/range.ts`, which 252 files reach, scans 11,340,237 entries and clones 28,545,624 evicting one file at a time, against 54,684 and 136,729 for the batch — 208x — and four edits fall 29,502,092 to 546,916. Recorded in `RECORDED_RESOLUTION_EVICTION_COST`.
- [ ] #4 #4 The six-number fingerprint is unchanged at n=200, 600 and 1,200. MEASURED: all seven components and both diagnostics digests identical between the two shapes at n=200, 600 and 1,200, and identical again over a 1,200-file load followed by four `update_file` edits.
- [ ] #5 #5 `ResolutionState`'s copy-on-write contract is unchanged, and the module records the conclusion plus a pointer — that the copy-on-write share attributed to it by profiling belongs to the export-gate rollback path rather than to bulk load, citing the TASK-381.7 harness row that measured it — so the mutable redesign is not re-proposed from a profile alone. The raw seconds live in the harness, not in a doc comment that will rot. The citation target is `RECORDED_RESOLUTION_EVICTION_COST.copy_on_write`, which carries the profile's seconds and the attribution: TASK-381.7's full-corpus checkpoint has not run, so it re-measures the split rather than supplying it. MEASURED on landed code at n=1,200: the bulk pass makes two applies, both over a state that was empty when they cloned it (0 cloned entries), so the profiled share is not bulk load's.
- [ ] #6 #6 `resolution_state.test.ts` stays green, including the eviction tests written against the per-file shape.

<!-- AC:END -->
