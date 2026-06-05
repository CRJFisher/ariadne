---
id: TASK-190.22.13
title: >-
  Strategist surfaces a per-core-fix effort estimate (cost axis for the plan DB)
status: To Do
assignee: []
created_date: '2026-06-04 00:00'
labels:
  - self-repair
  - plan-skill
  - plan-strategist
dependencies:
  - TASK-190.22.10
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Every `PlanTask` already carries a BENEFIT axis — `observed_count`, `projects`,
and `source_runs`, the recurrence/breadth/persistence of the false-positives a
fix would remove, bumped on augment as the issue recurs across sweeps. It carries
no COST axis, so the live task set cannot be ranked by cost against benefit.

The `plan-strategist` supplies the missing cost axis. For each core fix it
proposes, it estimates the fix's **blast radius** — how much complexity the fix
would add to Ariadne — as a positive integer, grounded by inspecting the owning
`fault_area` folder's current capability rather than inferred from the fault
pattern alone. Pairing this estimate with the benefit metrics makes the live DB
cost/benefit-rankable.

The strategist surfaces the metric; it assigns no priority, status, or
disposition. Ranking is deterministic and downstream: a consumer weighs effort
against the benefit signals (for example, an Eisenhower grid). Because the task
stays live, its cost is re-judged each sweep as the owning folder evolves and its
benefit climbs as the false-positive recurs.

## Scope

- Add `core_fix_effort` (a positive integer blast-radius estimate) and
  `core_fix_effort_rationale` (the prose grounding) to `StrategistPlanNode` and
  `PlanTask`.
- The `plan-strategist` agent emits both on every core-fix node, grounding the
  estimate by reading the owning `fault_area` folder with `Read`/`Grep`/`Glob` on
  the scale 1 (single-file edit) / 3 (new function or resolver path) / 5 (new
  cross-folder resolver pass). A node that proposes no core fix — a
  taxonomy-extension or classifier-work node — carries `core_fix_effort: 0` and an
  empty rationale. The classifier is framed as the interim mitigation that holds
  while a high-effort core fix waits.
- `validate_plan` requires a positive integer with non-empty rationale on every
  core-fix node and the `0` sentinel on every non-core-fix node;
  `get_bucket_context` surfaces the effort authoring rule.
- Pass C carries both fields verbatim from the node onto the `PlanTask`
  (`build_plan_tasks`) and adopts the fresh estimate when a sweep augments an
  existing task (`reconcile_plan`).
- The firewall and planning-only contract stay intact: the strategist writes only
  its `StrategistPlan` JSON; the deterministic reconcile pass is the sole writer of
  the task-DB; no new tool grant is added.

## Verification

A strategist plan whose core-fix nodes carry a positive `core_fix_effort` with a
grounded rationale reconciles to `PlanTask` rows carrying the same values; a
re-sweep that augments a task adopts the fresh estimate. `validate_plan` rejects a
core-fix node missing a positive effort or rationale, and rejects a
non-core-fix node carrying a non-zero effort. The plan engine makes zero writes to
`backlog/`, `registry.json`, or `packages/core`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `StrategistPlanNode` and `PlanTask` carry `core_fix_effort` (positive integer blast-radius estimate) and `core_fix_effort_rationale` (prose grounding)
- [ ] #2 The `plan-strategist` prompt instructs emitting the estimate on every core-fix node, grounded by reading the owning `fault_area` folder, with the `0` sentinel on taxonomy-extension and classifier-work nodes; `get_bucket_context` surfaces the rule
- [ ] #3 `validate_plan` requires a positive effort + non-empty rationale on core-fix nodes and the `0` sentinel elsewhere; Pass C carries both fields onto the `PlanTask` and augment adopts the fresh estimate
- [ ] #4 Firewall + planning-only contract preserved (strategist writes only its plan; reconcile is the sole task-DB writer; no new tool grant)

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

<!-- SECTION:NOTES:END -->
