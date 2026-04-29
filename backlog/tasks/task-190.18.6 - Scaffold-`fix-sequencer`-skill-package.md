---
id: TASK-190.18.6
title: Scaffold `fix-sequencer` skill package
status: To Do
assignee: []
created_date: "2026-04-29 10:32"
labels:
  - self-repair
  - fix-sequencer
  - scaffolding
  - critical-path
dependencies:
  - TASK-190.18.1
  - TASK-190.18.2
parent_task_id: TASK-190.18
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Establish the dependency surface and folder layout BEFORE any logic lands. The new skill must mirror sister-skill conventions exactly so future agents discover and operate it the same way.

## Scope — mirror triage-curator layout

```
.claude/skills/fix-sequencer/
├── SKILL.md
├── README.md
├── package.json
├── tsconfig.json
├── reference/                      # scoring_rubric.md and similar deep-dives
├── scripts/
│   ├── prepare_plan.ts             # cluster + score + render
│   ├── finalize_plan.ts            # apply user signoff → write graph
│   └── get_plan_summary.ts         # used as a !-bash block in SKILL.md
├── src/
│   ├── cluster_tasks_by_overlap.ts
│   ├── score_fix_impact.ts
│   ├── size_fix_complexity.ts      # v1: heuristic
│   ├── sequence_next_fixes.ts
│   ├── record_signoff_decision.ts
│   ├── enqueue_signed_off_fixes.ts
│   ├── fix_plan_types.ts
│   ├── paths.ts
│   └── *.test.ts (colocated)
└── templates/
    └── plan.md.tpl
```

- `pnpm-workspace.yaml` updated to include BOTH `.claude/skills/fix-sequencer` AND `.claude/skills/triage-curator` (the latter is required so `build_impact_rows` is importable; today it isn't a workspace member)
- `triage-curator/package.json` updated with an `exports` map that surfaces `build_impact_rows` (e.g. `"./impact_report": "./src/impact_report.ts"`)
- Empty entry points compile (no logic yet)
- `SKILL.md` mirrors sister-skill plumbing exactly:
  - `disable-model-invocation: true` (slash-command style, not autonomously triggered)
  - `argument-hint: [--run <path>] [--dry-run]`
  - `allowed-tools` enumerates: `AskUserQuestion`, `mcp__backlog__task_create`, `mcp__backlog__task_search`, `mcp__backlog__task_edit`, `mcp__backlog__task_view`, `Bash(node --import tsx:*)`, `Read`, `Write`, `Edit`, `Glob`, `Grep`
  - Body describes inputs, outputs, and the FIVE internal stages owned by fix-sequencer (cluster, score, render, signoff, materialize) — worker drain and reconciler are downstream contracts, not internal stages
- README references upstream chain (sister skill READMEs reference downstream — added in 190.18.14)
- `paths.ts` exposes:
  - Top-level constants: `FIX_SEQUENCER_DIR`, `GRAPH_JSON`, `STATE_JSONL`, `CALIBRATION_JSONL`
  - Helper `run_paths(run_id) → { plan_md, plan_json, clusters_json, decisions_json, finalized_json }` (typed return)
- `finalize_plan.ts` orchestrates the post-prepare pipeline: parse `--run <run_id>`, load `plan.json` + `decisions.json`, invoke signoff loop (190.18.10), invoke materializer (190.18.11), print `/schedule` one-liner (190.18.12), write `finalized.json` sentinel

## Critical-path

This subtask is part of the minimum-cut critical path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `pnpm-workspace.yaml` includes `.claude/skills/fix-sequencer` AND `.claude/skills/triage-curator`; `pnpm -F fix-sequencer build` succeeds and can resolve `build_impact_rows` from triage-curator
- [ ] #2 SKILL.md sets `disable-model-invocation: true`, lists `allowed-tools` per spec, declares `argument-hint`, and describes the five internal stages owned by fix-sequencer
- [ ] #3 `pnpm -F fix-sequencer test` runs (zero tests, exits 0)
- [ ] #4 README references upstream chain
- [ ] #5 `paths.ts` exports `FIX_SEQUENCER_DIR`, `GRAPH_JSON`, `STATE_JSONL`, `CALIBRATION_JSONL` constants and a typed `run_paths(run_id)` helper returning `{ plan_md, plan_json, clusters_json, decisions_json, finalized_json }`
- [ ] #6 `finalize_plan.ts` accepts `--run <run_id>` and `--dry-run`, orchestrates signoff → materialize → print one-liner → write sentinel
<!-- AC:END -->
