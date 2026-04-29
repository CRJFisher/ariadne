---
id: TASK-190.18.13
title: End-to-end demo on existing TASK-190.16.x backlog
status: To Do
assignee: []
created_date: "2026-04-29 10:34"
updated_date: "2026-04-29 14:27"
labels:
  - self-repair
  - fix-sequencer
  - verification
  - demo
dependencies:
  - TASK-190.18.3
  - TASK-190.18.5
  - TASK-190.18.9
  - TASK-190.18.11
parent_task_id: TASK-190.18
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Acceptance gate for the umbrella TASK-190.18. Wire-up smoke test against the real ~117 tasks proves the chain `triage-curator → fix-sequencer → graph → reconciler` works end-to-end before declaring v1 shipped.

## Steps

1. Run `fix-sequencer/scripts/prepare_plan.ts` against the latest finalized triage-curator run.
2. Confirm clusters render in `plan.md` and `clusters.json`.
3. Run `finalize_plan.ts`; answer `accept` for one cluster.
4. Verify `~/.ariadne/fix-sequencer/graph.json` contains a node for the accepted cluster, and `state.jsonl` has a `ready` event.
5. Append a `claim` event then a `done` event (with a synthetic `merge_commit`) to `state.jsonl` — manually or via `drain_graph.ts` stub.
6. Mark the corresponding member task Done in backlog (`mcp__backlog__task_complete`).
7. Run `self-repair-pipeline/scripts/prepare_triage.ts` — confirm `reconcile_registry_with_completed_nodes.ts` flips the registry entry's `status` to `fixed` and stamps `fixed_commit`.
8. Run `diff_runs.ts <prev> <new> --annotate-fixes` — confirm the resolved FP transitions are labeled "expected".

## Cleanup

A teardown script must remove the demo node, reset state.jsonl, and revert registry status so the run is repeatable.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Run produces `runs/<run_id>/{plan.md, clusters.json}` non-empty against the real 190.16.x backlog (note: clusters will be mostly singletons because existing tasks lack `touched_files`; that's expected and acceptable for v1)
- [ ] #2 At least one cluster reaches Accept and lands as a node in `graph.json`
- [ ] #3 After the synthetic `claim → done` event sequence and one `prepare_triage` run, the targeted registry entry has `status === "fixed"` AND `fixed_commit === "<stub-sha>"` (assert exact values, not existence)
- [ ] #4 `diff_runs --annotate-fixes` labels the resulting FP→TP transitions as `expected: registry entry <group_id> fixed at <stub-sha>`
- [ ] #5 Test uses an isolated `HOME` (or `ARIADNE_HOME` / equivalent) so the user's real `~/.ariadne/` is untouched
- [ ] #6 Cleanup step (script or Makefile target) removes the demo node, resets state.jsonl, and reverts registry status so the run is repeatable
<!-- AC:END -->
