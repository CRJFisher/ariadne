---
id: TASK-190.22.8
title: Implement the JSON plan task-store behind PlanTaskRepository
status: To Do
assignee: []
created_date: "2026-06-01 15:18"
labels:
  - self-repair
  - task-db
  - engine
dependencies:
  - TASK-190.22.4
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The concrete storage behind the `PlanTaskRepository` interface (190.22.4). JSON-on-disk now; the interface is the seam that makes SQLite/vector a drop-in follow-on (deferred draft). Lives in the `plan` skill's `src/store/` (domain logic; not in skill-protocol, which is types-only, nor skill-fs, which is generic primitives).

## Scope

- One-file-per-task: `~/.ariadne/plan/tasks/<task_id>.json`, written via `@ariadnejs/skill-fs` `atomic_write_file` (single writer per task file — rename-atomic, NO global lock needed; this deliberately stays out of the registry-writer lock contract). The path helper `plan_task_path(id)` does NOT sanitize, so whatever mints `PlanTaskId` here must produce filesystem-safe ids (no `/`, no `..`) — the brand carries no grammar by design (190.22.4).
- Append-only provenance: `~/.ariadne/plan/sweeps/<sweep_id>.jsonl` (`PlanSweepEvent` per line), via `appendFile`.
- Implement `JsonPlanTaskRepository implements PlanTaskRepository`: `query`/`find_by_dedup_key`/`children_of` = `readdir` + `JSON.parse` + in-memory filter (the proven `discover_runs`/`scan_runs.ts` pattern); `put`/`put_many` = per-file `atomic_write_file`; `append_sweep_event` = `appendFile`.
- Schema-version guard on read (reject `schema_version` mismatch, like `parse_v4_triage_results`).
- Colocated tests: round-trip a `PlanTask`; query by fault*area/status/parent_id; `find_by_dedup_key` hit/miss; hierarchy walk; isolation via the `ARIADNE*\*\_OVERRIDE` temp-dir contract.

## Out of scope

No SQLite, no vector index (deferred). No global lock (one writer per task file). The repository interface is fixed by 190.22.4 — do not change its signatures.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `JsonPlanTaskRepository` implements `PlanTaskRepository` over `~/.ariadne/plan/tasks/<id>.json` (one file per task, `atomic_write_file`) + `sweeps/<id>.jsonl` (append-only)
- [ ] #2 `query`/`find_by_dedup_key`/`children_of` work via readdir+parse+filter; reads reject a `schema_version` mismatch
- [ ] #3 No global lock is used (single writer per task file); the store is NOT added to the registry-writer allowlist
- [ ] #4 Colocated tests cover round-trip, query-by-fault-area/status/parent, dedup-key hit/miss, hierarchy walk, and `ARIADNE_*_OVERRIDE` temp-dir isolation
- [ ] #5 `pnpm -r build && pnpm -r test` green; the SQLite/vector swap-seam (the interface) is untouched
<!-- AC:END -->
