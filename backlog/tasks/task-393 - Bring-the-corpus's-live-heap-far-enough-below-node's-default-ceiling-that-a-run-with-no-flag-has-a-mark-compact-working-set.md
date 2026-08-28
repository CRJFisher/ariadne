---
id: TASK-393
title: "Bring the corpus's live heap far enough below node's default ceiling that a run with no flag has a mark-compact working set"
status: To Do
assignee: []
created_date: "2026-08-28 19:40"
labels:
  - memory
  - performance
dependencies:
  - TASK-381.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A user who types `ariadne` at a repository of vscode's scale, on a machine
where node's old-space ceiling is its default, gets no entry-point report. The
process spends 444.3 s of CPU and then dies with `FATAL ERROR: Reached heap
limit Allocation failed - JavaScript heap out of memory`. Getting a report
requires `--max-old-space-size=6144` on the command line that starts the
process, which TASK-381.16 measured, documented and deliberately did not
automate: Ariadne sets no heap flag itself.

The shortfall is small and it is not storage. Measured over microsoft/vscode at
f3fa55c3, `src/`, 8,494 discovered files, on ariadne@417de2fc: the live heap
after a forced collection is **4,046.1 MB**, identical to a tenth of a megabyte
whether the run was given a 6,192 MB ceiling or a 12,336 MB one. The default
ceiling on that machine is 4,144 MB. So the load retains 97.9 MB less than the
ceiling and still cannot run under it — every mark-compact near the limit frees
single-digit megabytes for one to two seconds of work, the last one at a mutator
utilisation of 0.018. What is missing is collector working set, not room for the
data.

This task is the reduction: get what the corpus retains far enough below 4,144
MB that V8 has a working set at the default ceiling, so the flag stops being the
difference between a report and a fatal error.

## Where the live heap is

Unmeasured. The 4,046.1 MB figure is a whole-process reading and nothing here
attributes it to the structures that hold it. The first work is that
attribution, over the same corpus and the same commit, before any structure is
changed: retained bytes by owner, taken by deletion under forced GC the way
`RECORDED_NAME_TABLE_MEMORY` took the per-scope name table's.

Two candidates are already named by measurements on record and neither is
confirmed as the holder. `RECORDED_NAME_TABLE_MEMORY` shows the parent-chain
name table retains 10 KB/file where the flattened table retained 110-172, so
that structure is already reduced. `RECORDED_CORPUS_PASS_COST` shows the grep
index capped at insertion is TASK-381.12's surface. The seven-component
fingerprint is the guard for any of it: a reduction that moves the reported call
graph is not a reduction.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The 4,046.1 MB live heap is attributed to the structures that hold it, measured by deletion under forced GC over every discovered file of vscode `src/` at f3fa55c3, and the attribution closes over the whole-process reading rather than accounting for part of it.
- [ ] #2 A full-corpus cold load of every discovered file under vscode `src/` completes with NO `--max-old-space-size` flag, on a machine whose default ceiling is recorded, and the run's mutator utilisation stays above the thrash the current build dies in (last mark-compact 2,259 ms freeing 8.6 MB at mu 0.018).
- [ ] #3 The live heap after a forced collection is recorded as a mean over >= 2 independent runs with its spread, beside the peak RSS at the same ceiling, and the headroom below the default ceiling is stated as a figure rather than as "fits".
- [ ] #4 The seven-number fingerprint over the `src/` corpus is byte-identical to `RECORDED_ORDER_INDEPENDENCE`'s recorded digests, and the diagnostics `canonical_hash` with it: a load that retains less and reports a different call graph has lost coverage rather than saved memory.
- [ ] #5 CPU over the corpus is judged against an interleaved control arm in the same session, because a reduction that trades the ceiling for a slower load is stated as that trade rather than as a win. The current cost of collecting against the smaller ceiling is 1.02x, measured in TASK-381.16's own session.
- [ ] #6 `RECORDED_MEMORY_CONTRACT` and the memory contract in `packages/core/src/benchmark_corpus_load/README.md` are re-stated for whatever this lands: the requirement, the bracket, and the corpus each holds for. The `src/` floor is not carried to the repository root, which retains more than the floor at 12,654 discovered files.

<!-- AC:END -->
