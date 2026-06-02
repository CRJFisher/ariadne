---
id: TASK-190.22.4
title: >-
  Define the plan task-DB contract (PlanTask + repository interface + paths) in
  @ariadnejs/skill-protocol
status: To Do
assignee: []
created_date: "2026-06-01 15:17"
labels:
  - self-repair
  - task-db
  - data-contract
dependencies:
  - TASK-190.22.2
  - TASK-190.22.3
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The `plan` engine writes its proposed work to a queryable **task-database** it owns (not the user's `backlog/`). The _type_ + _repository interface_ + _path helpers_ are private inter-skill plumbing, so they live in `@ariadnejs/skill-protocol` (the same charter as `TriageResultsFile`/`RunId`/paths). The storage _implementation_ is built separately in TASK-190.22.8. Keeping this type-only preserves Phase 2's mechanical character.

## Scope (type/interface/paths only — no I/O)

- `src/plan_task.ts` — `PlanTask` record: `id` (branded `PlanTaskId`), hierarchy (`tier: architectural|fault_area|localized`, `parent_id`, `child_ids`), `title`/`body`, `fault_area: AriadneFaultArea` (the grouping key, from `@ariadnejs/types` — 190.22.3), `evidence: PlanTaskEvidence[]` (each = canonical `MemberEvidence {file,line,why}` + `project`/`run_id` + the raw `diagnosis`/`resolution_stage`/`resolution_reason` so the area stays re-derivable), `observed_count`/`projects[]`/`source_runs[]` rollups, `status: PlanTaskStatus` (`proposed|accepted|superseded|exported|abandoned`), `superseded_by`, `exported_backlog_task`, provenance (`created_in_sweep`/`updated_in_sweep`/`strategist`), and `dedup_key` (stable hash of `fault_area` + sorted evidence file:line set, for cross-sweep reconciliation). `PLAN_TASK_SCHEMA_VERSION` constant (twin of `TRIAGE_RESULTS_SCHEMA_VERSION`).
- `src/plan_task_repository.ts` — the `PlanTaskRepository` interface the engine calls (the swap-seam): `get(id)`, `query({fault_area?,status?,tier?,parent_id?,dedup_key?})`, `children_of(id)`, `find_by_dedup_key(key)`, `put(task)`, `put_many(tasks)`, `append_sweep_event(sweep_id, event)`. Plus a `PlanSweepEvent` discriminated union (`create|augment|supersede|combine|export`).
- `src/paths.ts` — add `plan_tasks_dir()`, `plan_task_path(id)`, `plan_sweeps_dir()` under `~/.ariadne/plan/`, honoring the lazy `ARIADNE_*_OVERRIDE` env-var contract (same as the other path helpers).
- Barrel-export all of the above.

## Constraints

- Reuse `AriadneFaultArea` from `@ariadnejs/types`; reuse the COLLAPSED `MemberEvidence {file,line,why}` + `RunId` from skill-protocol — depends on the Phase-2 `MemberEvidence` collapse landing first.
- No storage logic, no `mcp__backlog`, no SQLite. The interface is designed so a SQLite/vector impl is a drop-in later (see the deferred follow-on draft).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `@ariadnejs/skill-protocol` exports `PlanTask` (+ `PlanTaskId`, `PlanTaskStatus`, `PlanTaskTier`, `PlanTaskEvidence`, `PlanSweepEvent`) and `PLAN_TASK_SCHEMA_VERSION`; `fault_area` is typed as `AriadneFaultArea` (imported from `@ariadnejs/types`), evidence uses the collapsed `MemberEvidence {file,line,why}`
- [ ] #2 `PlanTaskRepository` interface exported with get/query/children_of/find_by_dedup_key/put/put_many/append_sweep_event; `PlanTaskQuery` supports fault-area/status/tier/parent_id/dedup_key filters
- [ ] #3 `plan_tasks_dir()`/`plan_task_path(id)`/`plan_sweeps_dir()` added to `paths.ts` under `~/.ariadne/plan/`, honoring the `ARIADNE_*_OVERRIDE` lazy contract
- [ ] #4 Type-only: no I/O, no `mcp__backlog`, no storage engine; `pnpm typecheck` green
- [ ] #5 `dedup_key` is documented as `fault_area` + sorted evidence file:line set, sufficient for exact-overlap cross-sweep reconciliation
<!-- AC:END -->
