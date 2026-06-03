---
id: TASK-190.22.8
title: Implement the JSON plan task-store behind PlanTaskRepository
status: Done
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

- [x] #1 `JsonPlanTaskRepository` implements `PlanTaskRepository` over `~/.ariadne/plan/tasks/<id>.json` (one file per task, `atomic_write_file`) + `sweeps/<id>.jsonl` (append-only)
- [x] #2 `query`/`find_by_dedup_key`/`children_of` work via readdir+parse+filter; reads reject a `schema_version` mismatch
- [x] #3 No global lock is used (single writer per task file); the store is NOT added to the registry-writer allowlist
- [x] #4 Colocated tests cover round-trip, query-by-fault-area/status/parent, dedup-key hit/miss, hierarchy walk, and `ARIADNE_*_OVERRIDE` temp-dir isolation
- [x] #5 `pnpm -r build && pnpm -r test` green; the SQLite/vector swap-seam (the interface) is untouched
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Why this work exists.** `PlanTaskRepository` (190.22.4) is the type-only swap-seam the `plan` engine reads and writes its task-DB through; this task supplies the concrete JSON-on-disk implementation behind it. JSON now, with the interface as the seam that makes a SQLite/vector store a drop-in follow-on later. The store is domain logic, so it lives in the `plan` skill's `src/store/` — not in `skill-protocol` (types-only) nor `skill-fs` (generic primitives).

**What was built.** Three colocated files under `.claude/skills/plan/src/store/`:

1. `json_plan_task_repository.ts` — `JsonPlanTaskRepository implements PlanTaskRepository`, all seven methods:
   - **Task files** — one JSON file per task at `~/.ariadne/plan/tasks/<id>.json`, written through a private `write_one` via `@ariadnejs/skill-fs` `atomic_write_file` (temp + POSIX rename), pretty-printed with a trailing newline for diffability. `put` writes one; `put_many` `mkdir -p`s once then writes each file concurrently with `Promise.all`. Single writer per file → rename-atomic with **no** global lock.
   - **Sweep log** — `append_sweep_event` `mkdir -p`s `sweeps/` then appends one compact `PlanSweepEvent` JSON object per line to `sweeps/<sweep_id>.jsonl` via `appendFile`.
   - **Reads** — `get` reads the one exact `<id>.json` (ENOENT → `null`, else parse-or-throw); `query`/`children_of`/`find_by_dedup_key` all route through a private `read_all` (the `discover_runs` `readdir` + per-file parse + in-memory filter pattern; absent dir → `[]`; non-`.json` entries skipped by name). `query` AND-s every supplied filter field (absent matches all); `find_by_dedup_key` returns an array so the engine can pick the live row among a key that also carries a superseded one.
2. `plan_task_record.ts` — `parse_plan_task`, the strict read boundary (twin of `parse_triage_results`). It rejects a non-object, a `schema_version` ≠ `PLAN_TASK_SCHEMA_VERSION`, and a wrong-kind field under a single stated rule: validate exactly the fields whose wrong kind fails *silently* downstream — the strings the store keys/filters on (`id`/`tier`/`fault_area`/`status`/`dedup_key`, a non-string mis-routes a query) and the arrays a consumer iterates (`child_ids`/`evidence`/`projects`/`source_runs`, a non-array throws far from the store). Everything else is a harmless passthrough the engine owns, kept at the same altitude as `parse_triage_results` deferring deep-row validation to its producer.
3. `json_plan_task_repository.test.ts` — colocated tests, isolated by setting `ARIADNE_PLAN_DIR_OVERRIDE` to a per-test `mkdtemp` dir (saved/restored around each case; the protocol path helpers read the override lazily, so no module re-import is needed).

**Approach / key decisions.**

- *Paths come from `@ariadnejs/skill-protocol`* (`plan_tasks_dir`/`plan_task_path`/`plan_sweeps_dir`), which honor `ARIADNE_PLAN_DIR_OVERRIDE` lazily — so the store needs no constructor-injected root and tests isolate purely by the env override. `plan_task_path` does not sanitize, so ids must already be filesystem-safe (the brand carries no grammar; minting is the engine's concern, 190.22.10).
- *Malformed content during a scan throws, it is not skipped.* This is the one deliberate divergence from `discover_runs`, which skips by **name** only (legacy filenames). A `.json` file in `tasks/` with bad content or a stale `schema_version` is corruption of the engine's own DB, and AC#2 requires bulk reads to reject it — so `read_all` lets `parse_plan_task` throw. Only non-`.json` debris (a `.DS_Store`, an interrupted `atomic_write_file` temp named `<id>.json.tmp.<pid>.<uuid>`) is skipped by the suffix filter.
- *No registry lock, no allowlist entry* — single writer per task file means `atomic_write_file` alone is correct; the `<id>.json` path is not registry-shaped, so `registry_writers.test.ts` produces no hit and the store rightly never appears in `ALLOWED_REGISTRY_WRITERS`.
- *The interface is frozen* — no signature changes to `PlanTaskRepository`; the SQLite/vector swap-seam is untouched.

**Review hardening.** A six-lens opus review (two behavioral, contracts, completeness, IA, adversarial cold-read) confirmed the logic and contract conformance and surfaced cheap improvements, all applied: a `toHaveLength(1)` assertion that violated the project's assert-exact-values rule is now `toEqual` on the typed task literal; the `query()` `tier` and `dedup_key` filter branches — implemented but previously exercised only indirectly — gained direct tests; and three documentation gaps were closed (the parser's field-selection rule is now stated explicitly, the no-lock guarantee is extended in the class doc to the single-sweep-writer sweep log, and `put_many` is documented as per-file atomic but not batch-atomic with the engine owning partial-batch recovery). Noted-but-not-actioned as YAGNI: an `EISDIR` guard for a foreign `.json`-named *directory* (the store never creates subdirs) and a `typeof` pre-check on `schema_version` (the engine always writes a number).

**Tests (17, all green).** Round-trip; `get` miss → `null` (dir-absent and file-absent); `query` by fault_area / status / parent_id / tier / dedup_key and an AND-ed two-field filter; empty filter returns all; non-`.json` entries skipped; `find_by_dedup_key` hit (live + superseded sharing a key) and miss; `children_of` hierarchy walk; `schema_version` mismatch rejected on both `get` and bulk `query`; `append_sweep_event` round-trips as one-object-per-line JSONL. `pnpm -r build` and the full `pnpm -r test` (3314 tests) are green; `registry_writers.test.ts` stays green untouched.

<!-- SECTION:NOTES:END -->
