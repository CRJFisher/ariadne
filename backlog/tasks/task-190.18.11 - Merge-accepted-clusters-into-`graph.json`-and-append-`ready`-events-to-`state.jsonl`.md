---
id: TASK-190.18.11
title: >-
  Merge accepted clusters into `graph.json` and append `ready` events to
  `state.jsonl`
status: To Do
assignee: []
created_date: "2026-04-29 10:34"
updated_date: "2026-04-29 14:27"
labels:
  - self-repair
  - fix-sequencer
  - graph-write
  - critical-path
dependencies:
  - TASK-190.18.9
parent_task_id: TASK-190.18
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

This is the _materialization_ step — accepted clusters become nodes in the work-DAG that workers can drain. The graph + state-log pattern (vs a directory queue or SQLite) was chosen so the queue is git-independent, append-friendly, and naturally supports dependency edges.

## Scope

- File: `.claude/skills/fix-sequencer/src/enqueue_signed_off_fixes.ts`
- Wired into `.claude/skills/fix-sequencer/scripts/finalize_plan.ts`
- For each cluster decision = `accept`:
  1. Add a node to `~/.ariadne/fix-sequencer/graph.json` with these fields:
     - `cluster_id`, `kind: "cluster"`, `rank`, `score`, `complexity`, `blast_radius`, `is_pareto_frontier`, `member_task_ids`, `intra_order`, `source_run_id`, `accepted_at`
  2. If `decisions.json[cluster_id].refactor_proposal_requested === true`, create a refactor-proposal backlog task via `mcp__backlog__task_create` (parent: `TASK-190.19.<n>` namespace), then add the resulting task ID to the node's `member_task_ids` (at the front of `intra_order`).
  3. (v1 has no edges — `blocks` edges remain unused until a real edge detector ships in v1.5)
  4. Atomic write of `graph.json` (temp file + rename)
  5. Append a `ready` event for the new node to `state.jsonl` via a single `O_APPEND` write. **The `ready` event is observability-only** — per the worker contract (190.18.9) a node is implicitly ready when present in the graph with no later events.
  6. **Append a calibration `predicted` row** to `~/.ariadne/fix-sequencer/calibration.jsonl`: `{ event: "predicted", cluster_id, run_id, complexity, impact, members, ts }`. Schema documented in `reference/worker_contract.md` (owned by 190.18.9).

## Cut from earlier draft

`refactor_proposal_task_id`, `accepted_by`, and the `release` event are removed from the v1 node schema. `refactor_proposal_task_id` is replaced by appending the task ID directly to `member_task_ids` (the refactor IS a member of the cluster). `accepted_by` was a constant `"user"` in single-user v1 — useless. `release` events are deferred until multi-worker concurrency lands.

## Idempotency

Re-running on identical decisions: graph.json byte-equal AND no new lines appended to state.jsonl AND no new `predicted` rows appended to calibration.jsonl. Dry-run flag prints intended mutations without executing.

## Concurrency

v1 explicitly assumes a single worker. Race conditions and crash recovery are deferred per YAGNI. The atomic-write semantics of graph.json are tested ONLY against one concurrent reader (the reconciler) — not against multiple writers.

## Absorbed responsibility

The calibration `predicted` writer was originally specified in TASK-190.18.12. After Reviewer 2's merge consolidation (.12 archived, contract docs moved to .9), the `predicted` write naturally sits here alongside the graph node write — both are side effects of accepting a cluster.

## Critical-path

This subtask is part of the minimum-cut critical path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Dry-run flag prints intended graph mutations and calibration appends without executing
- [ ] #2 Idempotent: re-running on identical decisions leaves graph.json byte-equal AND appends zero new lines to state.jsonl AND zero new lines to calibration.jsonl
- [ ] #3 Atomic write semantics for graph.json (temp file + rename); tested against one concurrent reader (the reconciler)
- [ ] #4 state.jsonl writes use single `O_APPEND` for atomic event append
- [ ] #5 Schema validated against types defined in `fix_plan_types.ts`; node uses `is_pareto_frontier` (not `frontier`)
- [ ] #6 When `decisions.json[cluster_id].refactor_proposal_requested === true`, a refactor backlog task is created and its ID appended to `member_task_ids[0]` and `intra_order[0]`
- [ ] #7 Validation rejects a node whose `member_task_ids` overlap any existing graph node's `member_task_ids`
- [ ] #8 Per accepted cluster, exactly one `predicted` row appended to calibration.jsonl with fields { event, cluster_id, run_id, complexity, impact, members, ts }
<!-- AC:END -->
