---
id: TASK-190.18.12
title: Worker contract docs + `/schedule` one-liner + calibration `predicted` row
status: To Do
assignee: []
created_date: "2026-04-29 10:34"
labels:
  - self-repair
  - fix-sequencer
  - documentation
  - calibration
dependencies:
  - TASK-190.18.11
parent_task_id: TASK-190.18
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Workers (eventually parallel cloud worktrees) need a documented contract for how to drain the graph. v1 ships the _contract_ and a stub reference implementation; production worker is downstream of TASK-190.18.

## Scope

### Worker contract document

- File: `.claude/skills/fix-sequencer/reference/worker_contract.md`
- Documents:
  - **Fold rule**: a node has implicit state `ready` iff it appears in `graph.json` AND no event for it exists in `state.jsonl`. The explicit `ready` event written by 190.18.11 is observability-only; pickers MUST NOT require it. Latest event for a given node wins.
  - **Pick rule**: lowest-rank node in state `ready` (implicit or explicit). v1 ships with no `blocks` edges, so prereq-resolution logic is documented but trivially satisfied.
  - **Events**: `claim` (worker_id, ts), `progress` (note, ts), `done` (merge_commit, ts).
  - **State machine per node**: `ready → claimed → in_progress → done`.
  - **Single-worker assumption** — v1 has no `release` event, no race-handling, no crash-recovery janitor. Multi-worker concurrency is a v1.5 concern.

### Reference implementation

- File: `.claude/skills/fix-sequencer/scripts/drain_graph.ts`
- Stub that runs end-to-end on one ready node:
  - Folds state, picks lowest-rank ready node, appends `claim`, appends a synthetic `done` with `merge_commit: "<stub-sha>"`
  - Appends a `landed` row to `calibration.jsonl` after the `done` event (so the calibration loop closes even in stub mode)
  - Prints what a real worker would do (file edits, tests, commit) but does NOT modify code or run tests
- Acts as living documentation of the contract AND closes the predicted/landed calibration round-trip in v1

### `/schedule` one-liner

- After `finalize_plan.ts` accepts clusters, print one copy-paste `/schedule` invocation referencing the graph path
- Skill itself does NOT execute `/schedule`

### Calibration log

- File: `~/.ariadne/fix-sequencer/calibration.jsonl` (append-only)
- **Writer of `predicted` rows**: this task. On signoff (`finalize_plan.ts`), append `{ event: "predicted", cluster_id, run_id, complexity, impact, members, ts }` per accepted cluster.
- **Writer of `landed` rows**: `drain_graph.ts` stub (above) appends `{ event: "landed", cluster_id, merge_commit, ts }` after each synthetic `done`. Real production worker will replace this with the real merge commit later.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 stdout contains exactly one `/schedule` line per `finalize_plan` invocation regardless of cluster count, referencing the graph path
- [ ] #2 Calibration JSONL append-only; both `predicted` and `landed` row schemas documented in worker_contract.md
- [ ] #3 reference/worker_contract.md covers fold rule, pick rule, claim/progress/done events, and the implicit-ready convention
- [ ] #4 drain_graph.ts on one ready node: appends claim → done → calibration `landed` row, without editing any code or running any tests
- [ ] #5 Skill itself does not execute `/schedule`
<!-- AC:END -->
