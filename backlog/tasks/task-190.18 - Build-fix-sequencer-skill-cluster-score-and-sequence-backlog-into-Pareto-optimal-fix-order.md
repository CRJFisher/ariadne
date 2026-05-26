---
id: TASK-190.18
title: >-
  Build fix-sequencer skill: cluster, score, and sequence backlog into
  Pareto-optimal fix order
status: To Do
assignee: []
created_date: "2026-04-29 10:28"
labels:
  - self-repair
  - fix-sequencer
  - capstone
  - skill-build
dependencies: []
parent_task_id: TASK-190
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Two upstream skills (`triage-entrypoints`, `triage-curator`) currently land tasks in the backlog one-by-one with no view of which to ship first, no cross-task overlap analysis, and no closed loop from "task shipped" to "registry status updated." `fix-sequencer` is the third and final skill in the self-healing chain — the only stage that asks the user a _strategic_ question. It earns its place in the intention tree by accelerating the rate at which root-cause fixes land, which directly improves call-graph fidelity (the trunk).

## Three-store architecture (one per concern)

- **Registry (`.claude/skills/triage-entrypoints/known_issues/registry.json`)** = shared truth between detection and fix-delivery. Group status (`wip` / `fixed`) and `fixed_commit` / `fixed_in_run`.
- **Backlog (`backlog/tasks/*.md`)** = canonical store of _task content_ (descriptions, AC, references). A "dumping ground" with no inherent ordering.
- **fix-sequencer graph + state log (`~/.ariadne/fix-sequencer/{graph.json,state.jsonl}`)** = canonical store of _priority and ordering_ + append-only execution events. Git-independent so parallel cloud workers can drain it without competing for git state.

## High-level flow

Seven phases stacked top-to-bottom in pipeline order: cluster → score → prepare plan → sign off → enqueue (writes the three persistent stores) inside the fix-sequencer skill's single-invocation boundary, then worker (async, /schedule-driven) and reconciler (fix-sequencer-owned but invoked as a pre-step of the next triage-entrypoints run). The persistent stores sit between the in-skill phases and the worker; `target project git log` joins them as a second reconciler input so out-of-band human fixes are caught alongside worker `done` events. The loop-closure edge from `wip → fixed` back to curator's registry read is the only red dotted arrow. (For where this skill fits in the broader chain see [triage-entrypoints → Self-healing pipeline](../../.claude/skills/triage-entrypoints/README.md#self-healing-pipeline).)

<!-- Source: ./task-190.18 - Build-fix-sequencer-skill-cluster-score-and-sequence-backlog-into-Pareto-optimal-fix-order.main.mmd — edit there, run `pnpm render-mermaid-diagrams` -->
![Fix-sequencer 7-phase flow](./task-190.18%20-%20Build-fix-sequencer-skill-cluster-score-and-sequence-backlog-into-Pareto-optimal-fix-order.main.svg)

**What to look for**: the dashed skill-boundary container holds Phases 1–5 — the in-skill, single-invocation slice. The worker (Phase 6) and reconciler (Phase 7) sit outside that container because they run on separate invocations (the worker asynchronously via `/schedule`; the reconciler as a pre-step of the next triage-entrypoints run, invoked across the skill boundary via CLI shell-out — never a TS import). The sign-off branch is the only place control forks: three labeled exits (`accept` / `drop` / `defer`), only `accept` reaches the enqueue step; `drop` and `defer` terminate non-destructively at `decisions.json`. Phase 5 is the **only fan-out write** in the in-skill slice — one accept decision lands writes on all three persistent stores (graph + state + calibration); misalignment would mean a partial accept. The reconciler has **two input sources** wired explicitly: `state.jsonl` (worker-driven `done` events; the reconciler folds the latest event per node) and the target project's git log (`scan <prior_commit>..HEAD` for Conventional-Commits scopes — both worker commits and human contributors flow through this path, so out-of-band fixes land even when the worker never ran). The synthesized `done` events from the git-log scan are in-memory only — never appended to `state.jsonl`. The registry's read surface now carries `drift_evidence` alongside `observed_count` / `observed_projects` — a curator-owned write the scorer weighs against promotion candidates. The red dotted edge (`wip → fixed` back to the registry's read side) fires on the *next* pipeline run, not synchronously, and is the only registry-write path in the diagram — the sequencer never writes the registry directly, and the reconciler's write goes through `atomic_update_registry`'s lock, so the write boundary is visually enforced. (Styling follows the canonical skill-diagrammer palette in `~/.claude/skills/skill-diagrammer/palette.md`; `regwrite` is the documented local extension for the single mutating write to shared mutable state.)

## Vocabulary

- **cluster** — a set of backlog tasks that share enough features to be worth shipping as one unit.
- **cluster_hint** — label written by triage-curator on each ariadne-bug task = the `root_cause_category` of the issue (one of: `receiver_resolution`, `import_resolution`, `cross_file_flow`, `syntactic_extraction`, `coverage_config`, `other`).
- **touched_files** — best-effort list of repo-relative POSIX paths the investigator believes a fix will edit; stamped on each curator-filed task by 190.18.2.
- **complexity** — heuristic S/M/L/XL label from `(touched_files_count, distinct_subsystems, root_cause_category)`. Maps to weights 1/3/8/21.
- **subsystem** — a coarse area of the Ariadne core code (`resolver`, `tree_sitter`, `signal_library`, `entry_point_walk`, etc.) inferred from `touched_files` paths via a documented prefix table.
- **blast_radius** — `isolated` | `shared` | `core_resolver`, derived from how many subsystems a cluster's `touched_files` span.
- **is_pareto_frontier** — boolean flag on a cluster: it is non-dominated on `(impact, -complexity, -risk)`.
- **intra_order** — the suggested execution order of member tasks inside a cluster (e.g. refactor first, then per-task fixes).
- **graph node / state event** — see `## Three-store architecture` above.

## Stages

1. Cluster ~117 existing TASK-190.16.x tasks (root_cause_category × Jaccard on `touched_files`; on the v1 corpus expect mostly singletons until backfill ships)
2. Heuristic complexity + impact scoring + Pareto frontier flag
3. Render `plan.md` + `clusters.json`
4. AskUserQuestion accept/drop/defer per cluster
5. Merge accepted clusters into `graph.json` and append `ready` events to `state.jsonl`
6. Worker drains graph (single-worker assumption in v1)
7. Reconciler in triage-entrypoints reads `state.jsonl` `done` events to flip registry `status: wip → fixed`

## Sub-tasks (10 active; 4 archived after Reviewer 2 merges)

Phase A — upstream prep: 190.18.1 (impact_report.json), 190.18.2 (touched_files + cluster_hint stamp), 190.18.3 (registry fix-tracking fields + reconciler), 190.18.5 (diff_runs --annotate-fixes).

Phase B — skill scaffold: 190.18.6.

Phase C — clustering & scoring: 190.18.7 (cluster + score + Pareto frontier).

Phase D — signoff & graph-write: 190.18.9 (render + signoff + worker contract + drain stub + /schedule), 190.18.11 (graph node write + ready event + calibration `predicted` writer).

Phase E — verification & docs: 190.18.13, 190.18.14.

**Archived (merged):** 190.18.4 (reconciler → folded into .3), 190.18.8 (scoring → folded into .7), 190.18.10 (signoff loop → folded into .9), 190.18.12 (worker contract + calibration + /schedule → folded into .9, with `predicted` writer moved to .11). Reviewer 2 flagged these as cuts that doubled test scaffolding without integration value; the merges preserve all the original AC items, distributed across the surviving tasks.

## Deferred to v1.5

LLM `cluster-sizer`; refactor child tasks `TASK-190.19.n.m`; `predicted_fix_subsystem` upstream enum; cross-run `diff_plans.ts`.

## Plan reference

Full plan: `/Users/chuck/.claude/plans/i-d-like-to-make-nested-creek.md`

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All 10 active sub-tasks (190.18.1, .2, .3, .5, .6, .7, .9, .11, .13, .14) created and linked under this umbrella; .4/.8/.10/.12 archived per Reviewer 2 merges
- [ ] #2 Running `prepare_plan.ts` + `finalize_plan.ts` on the existing TASK-190.16.x backlog produces ≥1 cluster node in `graph.json` and prints a `/schedule` one-liner — without needing 190.18.3/.5 to ship
- [ ] #3 Loop closure verified end-to-end: after appending a synthetic `done` event with `merge_commit: <sha>`, the targeted registry entry's `status === 'fixed'` AND `fixed_commit === <sha>` (assert exact values, not existence)
- [ ] #4 Three skill READMEs cross-reference correctly (triage-entrypoints → triage-curator → fix-sequencer)
- [ ] #5 No backwards-compatibility shims; intention-tree namings only (no `enhanced_*` / `*_v2` files)
<!-- AC:END -->
