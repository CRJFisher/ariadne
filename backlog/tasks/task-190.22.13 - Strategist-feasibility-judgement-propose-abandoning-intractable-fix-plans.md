---
id: TASK-190.22.13
title: >-
  Strategist feasibility judgement — propose abandoning intractable fix plans
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

The plan engine has two distinct paths by which a `PlanTask` leaves the live set,
and they are NOT the same concept:

- **`resolved`** (TASK-190.22.10) — a *mechanical* reconciliation outcome: the
  false-positives that grounded the task no longer appear in newer swept runs, so
  the underlying resolver bug appears fixed. Decided by the deterministic
  reconcile pass from evidence presence/absence — no judgement.
- **`abandoned`** (this task) — a *strategic* judgement: someone decides this
  class of false-positive cannot be fixed in a reasonable amount of time (the fix
  is intractable, out of Ariadne's reach, or not worth the cost relative to the
  workaround), so the plan should be retired rather than pursued. Decided by the
  `plan-strategist` agent (or a human reviewing the plan), looking at the issue
  itself — not at whether its evidence vanished.

TASK-190.22.10 deliberately scopes the deterministic reconcile script to make no
feasibility judgements; this task adds the judgement path.

## Scope

- Extend the `plan-strategist` agent's decision-making (`.claude/agents/plan-strategist.md`)
  so that, when the bucket's evidence describes a class of false-positive the
  strategist judges intractable / not worth a core fix, it can mark the
  corresponding plan node(s) as a proposed-abandon (with a justification in the
  node body) rather than emitting an actionable fix plan.
- Carry that signal from the `StrategistPlan` node through Pass C so the reconciled
  `PlanTask` lands `status: "abandoned"` with the strategist's rationale recorded
  as a `PlanSweepEvent` (an `abandon` event, mirroring how `resolved`/`superseded`
  are logged in 190.22.10).
- Keep the firewall and planning-only contract intact: the strategist still writes
  only its `StrategistPlan` JSON; the deterministic reconcile pass is still the
  only writer of the task-DB.

## Verification

A strategist plan that marks a node as proposed-abandon reconciles to a
`PlanTask` with `status: "abandoned"`, a logged `abandon` `PlanSweepEvent`, and
the strategist's rationale on the record; this is distinct from the `resolved`
(evidence-vanished) path, which remains decided by reconciliation alone.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The `plan-strategist` agent can mark a plan node as proposed-abandon with a written justification when it judges the fix intractable / not worth the cost
- [ ] #2 Pass C reconciles a proposed-abandon node to a `PlanTask` with `status: "abandoned"` and records the decision as an `abandon` `PlanSweepEvent`
- [ ] #3 The `abandoned` (judgement) path is kept distinct from the `resolved` (evidence-vanished, mechanical) path from 190.22.10
- [ ] #4 Firewall + planning-only contract preserved (strategist writes only its plan; reconcile is the sole task-DB writer)

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

<!-- SECTION:NOTES:END -->
