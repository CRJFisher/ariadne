---
id: TASK-190.22.17
title: >-
  Plan membership convergence: honor overrides on the re-routed-into area;
  validate plan identity against the dispatched bucket
status: Done
assignee: []
created_date: '2026-06-09 20:05'
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

Two holes in the 190.22.14 membership-verification work defeat its own goal — that a membership decision, once made, converges instead of being re-adjudicated every sweep.

## Hole 1 — override lookup keyed on the derived area only (two-hop re-adjudication loop)

`group_fault_areas` (`.claude/skills/plan/src/group/group_fault_areas.ts` ~line 101) consults the override store keyed `(derived area, member)`, then re-routes to `suggested_area` with no second lookup. Scenario: member derives to area A; an override (A → B) routes it into B's bucket; B's strategist excludes it (`belongs: false`); reconcile records an override keyed `(B, member)`. Next sweep the member again derives to A, again re-routes to B — and the `(B, member)` exclusion is never consulted. The member lands in B's bucket and is re-excluded every sweep, forever. The 190.22.14 convergence guard only blocks self-routing (A → A), not this two-hop loop. Fix: follow the re-route chain (consult the override store again for the destination area) before bucketing, with a cycle guard.

## Hole 2 — `validate_plan` never cross-checks the plan's top-level identity against the bucket

`src/types.ts` (~188–190) documents StrategistPlan as self-contained "so the validator and reconcile engine cross-check against the bucket fed to them", but `.claude/skills/plan/src/propose/validate_plan.ts` (~315–320) only checks `plan_raw.fault_area` is in the taxonomy and `sweep_id` is non-empty — neither is compared to the dispatched bucket's `fault_area`/sweep, even though `ValidatePlanContext` already carries `bucket_fault_area`. The validator's call site is `src/reconcile/load_staged_plans.ts` (it builds the `ValidatePlanContext` per staged plan/bucket pair — extend the context with the dispatched `sweep_id` there). `collect_membership_exclusions` (`.claude/skills/plan/src/reconcile/record_membership_decisions.ts` ~line 64) keys every override on the unchecked top-level `plan.fault_area`. A strategist that writes `fault_area: "X"` into `plans/Y.json` passes validation and its exclusions are recorded under X: dead for bucket Y (member re-adjudicated every sweep), and wrongly suppressing/re-routing if the member ever derives to X. The `membership_suggested_area_is_own_bucket` convergence guard (~line 275) checks against the bucket's area while the record is written under the plan's area, so the guard is bypassable. Fix: validator rejects a plan whose top-level `fault_area` or `sweep_id` does not match the bucket/sweep it was dispatched for.

## Coordination

Independent of TASK-190.22.15 (the overlap is confined to `src/reconcile/load_staged_plans.ts`, where this task adds one context field and .15 changes the rejected/missing accounting) — parallel work is fine; expect a trivial merge there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A member excluded from a bucket it was re-routed INTO is suppressed (or re-routed onward per the stored suggestion) on the next sweep — it does not re-enter that bucket for re-adjudication; covered by a test in group_fault_areas.test.ts exercising the derive→override→exclude→next-sweep loop
- [x] #2 Override chain following terminates safely on cyclic suggestions (A→B, B→A) with a deterministic, tested outcome
- [x] #3 validate_plan rejects a plan whose top-level fault_area does not equal the dispatched bucket's fault_area, and one whose sweep_id does not match the dispatched sweep, with distinct issue codes; covered in validate_plan.test.ts
- [x] #4 Membership exclusions can no longer be recorded under a fault area other than the dispatched bucket's area (the record_membership_decisions path is keyed consistently with the convergence guard)
- [x] #5 Existing 190.22.14 membership tests stay green; SKILL.md / module headers describe the convergence behavior canonically
<!-- AC:END -->

## Implementation Notes

## High-level summary

Pass A's override lookup now follows the full chain of override records instead of stopping after a single hop. `group_fault_areas` delegates to a named pure helper, `follow_override_chain`, which walks the override store from the member's derived area: if no override exists at the current area the member lands there; if the override suppresses it the member is dropped; if the override re-routes to another area the walk continues from that area. A `Set<AriadneFaultArea>` of visited areas detects cycles — when a cycle is reached every area in the chain has already excluded the member, so the correct outcome is suppression, not landing at the cycle-entry area. This closes the two-hop re-adjudication loop: a member excluded from a re-routed-into area is now suppressed on every subsequent sweep rather than re-entering that bucket indefinitely.

`validate_plan` now cross-checks the plan's top-level `fault_area` and `sweep_id` against the bucket and sweep it was dispatched for, emitting `plan_fault_area_mismatch` and `plan_sweep_id_mismatch` respectively. `ValidatePlanContext` carries `sweep_id` (with a doc-comment stating its guard purpose), and `load_staged_plans` threads the sweep id in. The `plan-strategist` agent's self-validate loop invocation and the CLI script's usage comment both include `--sweep-id`. SKILL.md Pass A prose describes the full chain-following and cycle-suppression semantics. All 36 directly-affected tests pass.
