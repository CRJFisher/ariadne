---
id: TASK-190.41
title: >-
  Track which triage runs a plan sweep has consumed, and make --last
  chronological
status: To Do
assignee: []
created_date: "2026-07-28 19:00"
updated_date: "2026-07-28 20:19"
labels:
  - self-repair
  - plan
  - idempotency
dependencies: []
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A `/plan` invocation has no memory of which triage runs it has already
processed. Pass A rescans the entire `analysis_output/` tree on every
invocation, so each sweep re-groups every run ever finalized — a bare
`group_runs.ts` today buckets 40 runs going back six weeks and 4,676
false-positives, of which only 20 runs and 3,465 FPs are new since the last
sweep. The `dedup_key` reconciliation in Pass C makes this _correct_ (a
re-swept run augments its task rather than duplicating it), which is precisely
why the waste is invisible: nothing is wrong in the output, so nothing signals
that the expensive part of the pipeline ran for no reason.

The cost lands on the one pass that cannot absorb it. Pass B dispatches an
opus/200-turn `plan-strategist` per bucket, and bucket size drives turn count.
Re-feeding stale evidence inflates every bucket, so the fan-out is re-spent on
false-positives that were already planned — and, worse, on false-positives from
commits so old that the code they indict may already be fixed. Evidence age is
not visible to the strategist, so a stale member grounds a task for a bug that
no longer exists.

The two gaps below are stated symptom → cause → direction. They share one
file and one seam — which runs a sweep selects — so they land together: a
consumption ledger whose selection is built on a comparator that does not order
by time would skip the wrong runs.

### 1. No record of which runs a sweep has consumed

**Symptom.** Every `/plan` invocation reprocesses the full history. There is no
way to ask "what is new since the last sweep?", and no way for the operator to
know whether a given run has been planned against.

**Cause.** `src/store/scan_runs.ts` treats consumption as out of scope by
construction. `apply_scan_filters` documents the position outright: "Idempotency
is not a concern here — the reconcile pass dedups by `dedup_key`, so re-feeding
an already-swept run augments its task rather than duplicating work." That
reasoning covers _correctness_ of the task rows and is sound as far as it goes;
it does not cover the Pass B cost, which is incurred before Pass C's dedup ever
runs. `SweepManifest` already records `run_ids` per sweep, but it is written
per-sweep under `staging/<sweep-id>/manifest.json` and is described as being
"kept for sweep auditability" — no reader ever aggregates it across sweeps.

**Direction.** A durable consumed-runs ledger under `~/.ariadne/plan/`,
alongside `membership_overrides.json` — the established precedent for
cross-sweep state that Pass C writes and Pass A reads. Key it on
`(project, run_id)` and stamp each entry with the sweep that consumed it, so the
ledger doubles as the provenance record for "which sweep planned this run."
Pass C is the sole writer, consistent with the existing write boundary.

Pass A then filters consumed runs out of `discover_runs`'s output by default,
with an explicit flag to re-include them for a deliberate re-sweep, and reports
the skipped count in the sweep summary so a no-op sweep says so rather than
printing an empty bucket list.

**A run must only be marked consumed when its evidence was actually planned.**
Pass C already tracks `blocked_fault_areas` — areas that had a bucket this sweep
but whose strategist plan was rejected or missing. A run contributing
false-positives to a blocked area has not been planned against, and marking it
consumed would silently discard that evidence from every future sweep. This is
the same failure mode Pass C's orphan-retirement guard already defends against
in the opposite direction, and it must be honoured here for the ledger to be
safe.

### 2. `--last N` returns the lexically-last runs, not the most recent

**Symptom.** `--last 20` against the current corpus returns 11 runs from June
and excludes the five most recent runs on disk, including the newest
(`747814f-2026-07-28T16-39-37`). The flag is documented as "Keep the most recent
N runs after filtering" and does not do that.

**Cause.** `discover_runs` sorts with `a.run_id.localeCompare(b.run_id)`. A
run-id is `<short-sha>-<ISO timestamp>`, so a lexical sort orders by _commit
sha_ first and only breaks ties by time. The docstring states the invariant
accurately — "ISO timestamps sort lexically within a commit" — but every caller
uses the ordering _across_ commits, where the sha dominates and the ordering is
effectively arbitrary. `apply_scan_filters` then takes `items.slice(-opts.last)`
off that arbitrary order.

**Direction.** Sort on the timestamp component rather than the whole run-id.
`@ariadnejs/skill-protocol` already owns run-id structure (`parse_run_id`,
`is_run_id`), so the comparator belongs behind that parse rather than as a
string operation in `scan_runs.ts`. Ties within a timestamp keep the sha as a
stable secondary key. `--last` then means what it says, and the ledger's
"skip consumed" default composes with it correctly.

### 3. (Non-goal) `dedup_key` reconciliation stays as it is

Pass C's augment-by-`dedup_key` behaviour is the correct backstop and is not
being replaced. The ledger is a cost filter in front of Pass B, not a
correctness mechanism — a re-swept run must still reconcile cleanly, because
`--all`-style re-sweeps and overlapping run sets remain legitimate. Recorded so
the ledger is not mistaken for a licence to weaken dedup.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Pass C records every run_id it reconciled into a durable consumed-runs ledger under ~/.ariadne/plan/, keyed by (project, run_id), stamped with the sweep that consumed it.
- [ ] #2 Pass A skips already-consumed runs by default, so a bare group_runs.ts sweeps only triage output no prior plan invocation has processed.
- [ ] #3 An explicit opt-in flag re-includes consumed runs for a deliberate re-sweep, and the sweep summary reports how many runs were skipped as already-consumed.
- [x] #4 discover_runs orders runs chronologically by their timestamp component rather than lexically by the sha-prefixed run_id, so --last N returns the N most recent runs.
- [ ] #5 A run consumed by a sweep whose strategist plan was rejected or missing for its fault areas is NOT marked consumed, so a failed sweep does not silently drop its evidence.
<!-- AC:END -->
