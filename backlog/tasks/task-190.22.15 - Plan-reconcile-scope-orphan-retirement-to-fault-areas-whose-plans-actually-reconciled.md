---
id: TASK-190.22.15
title: >-
  Plan reconcile: scope orphan retirement to fault areas whose plans actually
  reconciled
status: To Do
assignee: []
created_date: '2026-06-09 20:04'
updated_date: '2026-06-09 20:59'
labels:
  - self-repair
  - bug
dependencies: []
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

A routine failure mode — one strategist of N producing a missing or validation-rejected plan — currently causes the reconcile pass to falsely flip every live task in that strategist's fault area to `resolved`, destroying live planning state while the false-positives that justify those tasks still sit in the bucket file.

## Root cause

`retire_orphans` in `.claude/skills/plan/src/reconcile/reconcile_plan.ts` (~lines 285–298) treats any live task that is unclaimed AND fully within the swept project scope as an orphan. The gate is project-scoped only; there is no per-fault-area gate. The staged-plan loader `.claude/skills/plan/src/reconcile/load_staged_plans.ts` deliberately continues past rejected plans (each lands in `rejected`) and iterates only plan files that exist — a bucket with no staged plan file at all is not even reported in `rejected`. So a fault area whose plan failed contributes zero candidates, its tasks are unclaimed, and they are retired as "FPs stopped recurring" — when only the plan failed.

State self-repairs only on the next successful sweep, after emitting false `resolve` sweep events and terminal status flips.

## Fix direction

Gate orphan retirement on the set of fault areas whose plans were actually accepted and reconciled (or abort the sweep when buckets outnumber accepted plans). `load_staged_plans` is the place that knows which plans were accepted; buckets with no staged plan file must be surfaced there, not silently skipped. The driving script `scripts/reconcile_plan.ts` is a thin shim — keep the logic in `src/reconcile/`.

## Test gap

`reconcile_plan.test.ts` (~line 370) covers the partial-*project* sweep but not the rejected-plan / missing-plan-file cases. `load_staged_plans.test.ts` covers the loader's current accept/reject/missing-bucket behavior — extend it for missing-plan-per-bucket surfacing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A sweep where one fault-area bucket has a rejected (validation-failed) plan leaves that fault area's live tasks untouched — no resolve/supersede events, no status flips
- [ ] #2 A sweep where one fault-area bucket has no staged plan file at all leaves that area's live tasks untouched and reports the missing plan in the sweep outcome (not silently skipped)
- [ ] #3 Orphan retirement still fires for fault areas whose plans reconciled successfully within the same sweep (existing behavior preserved, covered by existing tests staying green)
- [ ] #4 New test cases live in the existing .claude/skills/plan/src/reconcile/reconcile_plan.test.ts covering both the rejected-plan and missing-plan scenarios with exact toEqual assertions on written records and sweep events
- [ ] #5 Module docs/header comments in reconcile_plan.ts describe the fault-area-scoped retirement gate canonically
<!-- AC:END -->
