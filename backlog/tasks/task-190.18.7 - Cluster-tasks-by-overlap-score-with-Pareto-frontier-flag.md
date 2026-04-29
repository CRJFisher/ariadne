---
id: TASK-190.18.7
title: Cluster tasks by overlap + score with Pareto frontier flag
status: To Do
assignee: []
created_date: "2026-04-29 10:32"
updated_date: "2026-04-29 14:24"
labels:
  - self-repair
  - fix-sequencer
  - clustering
  - critical-path
dependencies:
  - TASK-190.18.2
  - TASK-190.18.6
parent_task_id: TASK-190.18
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Cluster ~117 ariadne-bug + signal-gap backlog tasks so refactor opportunities surface, then convert clusters into a single ordered list the user can act on. Both stages are pure functions in the same `sequence_next_fixes.ts` pipeline; splitting them into separate tasks doubles the test scaffolding without integration value.

## Stage 1 — clustering algorithm (deterministic, no LLM at runtime)

Two-stage clustering:

1. **Group by `root_cause_category`** (or `cluster_hint` label when present) — uses the curator's existing taxonomy as a strong seed.
2. **Within each group**, run union-find over a Jaccard-thresholded similarity graph keyed on the union of two feature sets:
   - `touched_files` (from 190.18.2; treat absent as the empty set)
   - `labels` with stop-list applied (drop `bug`, `wip`, `priority/*`, `self-repair`, `triage-curator`, `fix-sequencer`, `cluster-hint:*`)

Singletons preserved. Empty-feature tasks fall into singleton clusters per documented behavior. **On the existing 117-task corpus, `touched_files` is absent — clustering will collapse to root_cause-only grouping (mostly singletons). Acceptable for v1.**

Cluster ID: `cluster_id = "c-" + sha1(sorted(member_task_ids).join("\n")).slice(0, 8)`.

## Stage 2 — scoring + Pareto frontier

```
impact      = sum(member.observed_count)
breadth     = distinct(member.observed_projects)
complexity  = heuristic over (touched_files_count, distinct_subsystems, root_cause_category)
              → S=1, M=3, L=8, XL=21
risk        = isolated=1, shared=1.5, core_resolver=2.5

score = (impact * (1 + 0.25 * breadth)) / (complexity * risk)
```

Compute Pareto frontier on `(impact, -complexity, -risk)`; surface as one ordered list with an `is_pareto_frontier: bool` flag per cluster.

## Reuse

Import `build_impact_rows()` from triage-curator (per workspace setup in 190.18.6). Do not duplicate.

## Files

- `.claude/skills/fix-sequencer/src/cluster_tasks_by_overlap.ts` (clustering)
- `.claude/skills/fix-sequencer/src/score_fix_impact.ts` (scoring)
- `.claude/skills/fix-sequencer/src/size_fix_complexity.ts` (heuristic complexity, v1)
- `.claude/skills/fix-sequencer/src/sequence_next_fixes.ts` (orchestrator: cluster → score → ranked list)

## Cut from earlier draft

`classifier_check_ops` was originally proposed as a third feature source; dropped because that field doesn't exist on `KnownIssue` and adding it is out of scope for v1. LLM `cluster-sizer` sub-agent → v1.5 only if Pareto rankings prove visibly wrong.

## Merge note

Originally split as TASK-190.18.7 (cluster) + TASK-190.18.8 (score). Merged after Reviewer 2 pointed out that cluster + score are a single pure-function pipeline; splitting yielded no integration value and doubled test scaffolding. .8 archived.

## Critical-path

Part of the minimum-cut critical path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `cluster_tasks_by_overlap(tasks)` deep-equals `cluster_tasks_by_overlap(shuffle(tasks))` for 50 random permutations; `cluster_id` is exactly `"c-" + sha1(sorted(member_task_ids).join("\n")).slice(0, 8)`
- [ ] #2 `JACCARD_THRESHOLD` and `LABEL_STOP_LIST` are documented named constants exported from the module
- [ ] #3 Table-driven cluster tests cover at least: transitive merge, threshold boundary, single-shared-feature, empty-vs-empty, conflicting cluster_hints
- [ ] #4 Empty-feature tasks fall into singleton clusters
- [ ] #5 Cluster function is pure: test injects throwing stubs for `fs`, `fetch`, `child_process`; the function returns successfully
- [ ] #6 Complexity heuristic is a pure function with table-driven tests
- [ ] #7 Pareto algorithm is its own pure function with 4+ corner-case tests
- [ ] #8 Output `scored_clusters.json` carries `score`, `rank`, and `is_pareto_frontier: bool`
- [ ] #9 Imports `build_impact_rows` from triage-curator (no duplication; cross-skill import works)
- [ ] #10 Score is finite for all inputs (guard `complexity * risk > 0`); rank tiebreak deterministic by `cluster_id` ascending
<!-- AC:END -->
