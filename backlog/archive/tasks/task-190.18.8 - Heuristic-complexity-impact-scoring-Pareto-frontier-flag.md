---
id: TASK-190.18.8
title: Heuristic complexity + impact scoring + Pareto frontier flag
status: To Do
assignee: []
created_date: "2026-04-29 10:32"
labels:
  - self-repair
  - fix-sequencer
  - scoring
  - critical-path
dependencies:
  - TASK-190.18.7
parent_task_id: TASK-190.18
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Convert clusters into a single ordered list the user can act on. Score ranks by leverage; Pareto flag preserves non-dominated alternatives without forcing the user to read a 2-D plot.

## Formula

```
impact      = sum(member.observed_count)
breadth     = distinct(member.observed_projects)
complexity  = heuristic over (touched_files_count, distinct_subsystems, root_cause_category)
              → S=1, M=3, L=8, XL=21
risk        = isolated=1, shared=1.5, core_resolver=2.5

score = (impact * (1 + 0.25 * breadth)) / (complexity * risk)
```

Compute Pareto frontier on `(impact, -complexity, -risk)`; surface as one ordered list with an `is_pareto_frontier: bool` flag per cluster (matching the field name on graph nodes in 190.18.11).

## Reuse

Import `build_impact_rows()` from `.claude/skills/triage-curator/src/impact_report.ts`. Do not duplicate.

## Files

- `.claude/skills/fix-sequencer/src/score_fix_impact.ts`
- `.claude/skills/fix-sequencer/src/size_fix_complexity.ts` (v1: heuristic only)
- `.claude/skills/fix-sequencer/src/sequence_next_fixes.ts` (combines into ranked list with Pareto flag)

## Deferred

LLM `cluster-sizer` sub-agent → v1.5 only if Pareto rankings prove visibly wrong.

## Critical-path

This subtask is part of the minimum-cut critical path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Complexity heuristic is a pure function with table-driven tests
- [ ] #2 Pareto algorithm is its own pure function with 4+ corner-case tests
- [ ] #3 Output `scored_clusters.json` carries `score`, `rank`, and `is_pareto_frontier: bool`
- [ ] #4 Imports `build_impact_rows` from `@ariadnejs/triage-curator/impact_report` (or equivalent workspace path established in 190.18.6)
- [ ] #5 Score is finite for all inputs (guard `complexity * risk > 0`); rank tiebreak is deterministic — by `cluster_id` ascending
<!-- AC:END -->
