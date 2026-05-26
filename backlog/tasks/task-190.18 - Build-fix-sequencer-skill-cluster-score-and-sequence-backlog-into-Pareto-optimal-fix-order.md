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

```mermaid
flowchart TD
  classDef step       fill:#fff8e1,stroke:#b58900,stroke-width:1.5px,color:#5d4037
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef store      fill:#ede7f6,stroke:#4527a0,stroke-width:1.5px,color:#311b92
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef branch     fill:#ffe0b2,stroke:#e65100,stroke-width:1.5px,color:#bf360c
  %% Local extension: regwrite marks the single mutating write to shared mutable state.
  %% Documented in palette.md → "What NOT to add to the canon" as a permitted skill-local class.
  classDef regwrite   fill:#fecaca,stroke:#991b1b,stroke-width:2.5px,color:#7f1d1d

  BL[/"backlog tasks<br/>touched_files · cluster_hint"/]:::ext
  IR[/"impact_report.json<br/>rows: ImpactRow[]"/]:::ext
  REG_R[("known_issues/registry.json<br/>observed_count · observed_projects · drift_evidence<br/><i>read-only here</i>")]:::store

  subgraph SKILL["Fix-Sequencer skill · in-skill phases (single invocation)"]
    direction TB
    subgraph P1["Phase 1 · Cluster"]
      direction TB
      S1("cluster_tasks_by_overlap.ts<br/>category × Jaccard(touched_files ∪ labels)"):::step
      I_RC(["raw clusters · member_task_ids"]):::inter
    end

    subgraph P2["Phase 2 · Score"]
      direction TB
      S2("score_fix_impact.ts + size_fix_complexity.ts<br/>+ Pareto frontier flag"):::step
      I_SC(["scored clusters · rank · is_pareto_frontier"]):::inter
    end

    subgraph P3["Phase 3 · Prepare plan"]
      direction TB
      S3("prepare_plan.ts<br/>render plan.md + clusters.json"):::step
      PLAN[/"runs/&lt;run-id&gt;/<br/>plan.md · clusters.json"/]:::artifact
    end

    subgraph P4["Phase 4 · Sign off (per cluster)"]
      direction TB
      SO{{"AskUserQuestion<br/>accept · drop · defer"}}:::branch
      DEC[/"runs/&lt;run-id&gt;/<br/>decisions.json (resumable)"/]:::artifact
    end

    subgraph P5["Phase 5 · Enqueue accepted clusters"]
      direction TB
      S5("enqueue_signed_off_fixes.ts<br/>atomic graph write + O_APPEND events"):::step
      SCHED[/"/schedule one-liner<br/>(printed, not exec'd)"/]:::artifact
    end
  end
  style SKILL fill:#fafafa,stroke:#424242,stroke-width:2.5px,stroke-dasharray:5 3,color:#212121

  GRAPH[("~/.ariadne/fix-sequencer/graph.json<br/>cluster DAG · <i>atomic temp+rename</i>")]:::store
  STATE[("~/.ariadne/fix-sequencer/state.jsonl<br/>append-only events<br/>ready · claim · progress · done")]:::store
  CAL[("~/.ariadne/fix-sequencer/calibration.jsonl<br/>predicted · landed rows")]:::store
  GITLOG[("target project git log<br/>fix&#40;task_id&#41;: commits<br/>(worker + human contributors)")]:::store

  subgraph P6["Phase 6 · Worker (async · single worker · /schedule driven)"]
    direction TB
    W1("drain_graph.ts<br/>fold state · pick lowest-rank ready"):::step
    W2("ship_fix.ts<br/>edits + tests + fix&#40;task_id&#41;: commit"):::step
  end

  subgraph P7["Phase 7 · Reconciler (fix-sequencer-owned · invoked by next triage-entrypoints run via CLI shell-out)"]
    direction TB
    OOB("git_log_scan.ts<br/>Conventional-Commits scope parse<br/>+ range expansion"):::step
    BR_REC{"latest event = done?<br/>OR out-of-band scope match?"}:::branch
    REC("reconcile_registry_with_completed_nodes.ts<br/>find_groups_by_backlog_task · atomic_update_registry"):::step
    REG_W[("known_issues/registry.json<br/><b>wip → fixed</b><br/>stamp fixed_commit + fixed_in_run")]:::regwrite
  end

  BL --> S1
  IR --> S1
  S1 --> I_RC
  I_RC --> S2
  REG_R -. "read · scorer weighs drift_evidence" .-> S2
  S2 --> I_SC
  I_SC --> S3
  S3 --> PLAN
  PLAN --> SO

  SO -- "accept" --> DEC
  SO -- "drop · no-op" --> DEC
  SO -- "defer · +reason" --> DEC
  DEC -- "decision == accept" --> S5
  S5 --> SCHED

  S5 -- "atomic write" --> GRAPH
  S5 -- "append ready" --> STATE
  S5 -- "append predicted" --> CAL

  SCHED -. "user runs /schedule" .-> W1
  GRAPH --> W1
  STATE --> W1
  W1 --> W2
  W2 -- "append claim → done" --> STATE
  W2 -- "append landed" --> CAL
  W2 -. "fix&#40;task_id&#41;: commit lands in" .-> GITLOG

  STATE -. "fold latest event (next run)" .-> BR_REC
  GRAPH -. "read DAG (next run)" .-> BR_REC
  GITLOG -. "scan &lt;prior_commit&gt;..HEAD" .-> OOB
  OOB -. "synthesized done (in-memory)" .-> BR_REC
  BR_REC -- "match" --> REC
  REC -- "flip wip → fixed" --> REG_W

  REG_W -. "next run: triage-entrypoints reads filter" .-> REG_R

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
  linkStyle 30 stroke:#ef5350,stroke-width:2.4px,stroke-dasharray:6 4
```

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
