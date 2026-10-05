---
id: TASK-190.22.4
title: >-
  Define the plan task-DB contract (PlanTask + repository interface + paths) in
  @ariadnejs/skill-protocol
status: Done
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

- [x] #1 `@ariadnejs/skill-protocol` exports `PlanTask` (+ `PlanTaskId`, `PlanTaskStatus`, `PlanTaskTier`, `PlanTaskEvidence`, `PlanSweepEvent`) and `PLAN_TASK_SCHEMA_VERSION`; `fault_area` is typed as `AriadneFaultArea` (imported from `@ariadnejs/types`), evidence uses the collapsed `MemberEvidence {file,line,why}`
- [x] #2 `PlanTaskRepository` interface exported with get/query/children_of/find_by_dedup_key/put/put_many/append_sweep_event; `PlanTaskQuery` supports fault-area/status/tier/parent_id/dedup_key filters
- [x] #3 `plan_tasks_dir()`/`plan_task_path(id)`/`plan_sweeps_dir()` added to `paths.ts` under `~/.ariadne/plan/`, honoring the `ARIADNE_*_OVERRIDE` lazy contract
- [x] #4 Type-only: no I/O, no `mcp__backlog`, no storage engine; `pnpm typecheck` green
- [x] #5 `dedup_key` is documented as `fault_area` + sorted evidence file:line set, sufficient for exact-overlap cross-sweep reconciliation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Why this exists.** The `plan` engine writes its proposed work to a queryable **task-DB it owns** (`~/.ariadne/plan/`), firewalled from the user's `backlog/`. The data contract for that DB — the record type, the repository interface the engine calls, and the on-disk path helpers — is private inter-skill plumbing, so it belongs in `@ariadnejs/skill-protocol` alongside the existing `TriageResultsFile` / `RunId` / path contract. This task defines that contract **type-only**: no storage logic, no I/O, no SQLite. The JSON storage implementation is a separate drop-in behind the interface (190.22.8); the engine that calls it is 190.22.10. Keeping this slice type-only preserves Phase 2's mechanical character and makes the interface the stable swap-seam a future SQLite/vector store plugs into.

**The approach — three new pieces in `packages/skill-protocol/src/`, barrel-exported.**

- **`plan_task.ts`** owns the `PlanTask` record and its supporting types. `PlanTaskId` is a branded string (twin of `RunId`). The grouping key `fault_area` is typed as `AriadneFaultArea` imported from `@ariadnejs/types` (190.22.3) — never a new enum. Evidence is `PlanTaskEvidence[]`, each row composing the collapsed `MemberEvidence {file,line,why}` (reused from `triage_results.ts`) with its `project` / `run_id` provenance plus the **raw** `diagnosis` / `resolution_stage` / `resolution_reason` so the fault area stays re-derivable from stored data via `derive_fault_area`. The record carries the size tier (`architectural | fault_area | localized`), hierarchy links (`parent_id` / `child_ids`), `title` / `body`, the cross-run rollups (`observed_count` / `projects[]` / `source_runs[]`), lifecycle `status` (`proposed | accepted | superseded | exported | abandoned`) with `superseded_by` / `exported_backlog_task`, sweep provenance (`created_in_sweep` / `updated_in_sweep` / `strategist`), and the `dedup_key`. A `PLAN_TASK_SCHEMA_VERSION` constant (twin of `TRIAGE_RESULTS_SCHEMA_VERSION`) lets the storage layer reject stale files.
- **`plan_task_repository.ts`** declares the `PlanTaskRepository` interface the engine calls — the swap-seam: `get`, `query`, `children_of`, `find_by_dedup_key`, `put`, `put_many`, `append_sweep_event`. `PlanTaskQuery` supports optional `fault_area` / `status` / `tier` / `parent_id` / `dedup_key` filters. `PlanSweepEvent` is a discriminated union over `create | augment | supersede | combine | export` capturing the reconciliation decisions the engine records per sweep.
- **`paths.ts`** gains `plan_tasks_dir()`, `plan_task_path(id)`, and `plan_sweeps_dir()` rooted at `~/.ariadne/plan/`, honoring the same lazy `ARIADNE_*_OVERRIDE` env-var contract as the triage path helpers so tests can isolate via a temp dir set before import.

**`dedup_key` semantics.** Documented as a stable hash of `fault_area` + the sorted set of the minting proposal's evidence `file:line` strings — sufficient for **exact-overlap** cross-sweep reconciliation: two proposals with the same fault area touching the same call sites collide and AUGMENT rather than duplicate. The key is computed once at create time and stored **immutably** — augment merges evidence and bumps rollups but never recomputes it, so a later re-sweep of the same proposal still hashes to the same value and matches. This task fixes the *meaning, inputs, and immutability* of the key; the hashing implementation lives with the store (190.22.8) / engine (190.22.10).

**Scope discipline.** Type/interface/path-helper only — `pnpm typecheck` is the bar, no runtime behavior beyond the pure path string-builders. No `mcp__backlog`, no storage engine, no global lock (the store deliberately stays out of the registry-writer lock contract). The interface signatures defined here are fixed for 190.22.8/190.22.10 to implement against.

## What was built

Three new pieces in `packages/skill-protocol/src/`, all barrel-exported, all type-only except the pure path string-builders:

- **`plan_task.ts`** — `PLAN_TASK_SCHEMA_VERSION = 1`; `PlanTaskId` (branded string, no constructor/grammar — minting is the store's single audited `as PlanTaskId` site, mirroring `build_run_id`); `PlanTaskStatus` (`proposed|accepted|superseded|exported|abandoned`); `PlanTaskTier` (`architectural|fault_area|localized`); `PlanTaskEvidence`; and the `PlanTask` record. The whole record (and `PlanTaskEvidence`) is total — no optional fields; hierarchy/lifecycle pointers use `| null`.
- **`plan_task_repository.ts`** — `PlanTaskQuery` (optional `fault_area`/`status`/`tier`/`parent_id`/`dedup_key`, AND-ed), the `PlanSweepEvent` discriminated union (`create|augment|supersede|combine|export`), and the `PlanTaskRepository` interface (`get`/`query`/`children_of`/`find_by_dedup_key`/`put`/`put_many`/`append_sweep_event`). `find_by_dedup_key` returns `PlanTask[]`, not a single task, so the engine can pick the live row among a key that also carries a superseded one. `PlanSweepEvent` lives here, not with the record, because it is a repository-method argument the record never embeds.
- **`paths.ts`** — `plan_tasks_dir()`/`plan_task_path(id)`/`plan_sweeps_dir()` rooted at a new lazy `plan_dir()` (`~/.ariadne/plan`, a **sibling** of the triage base, with its own `ARIADNE_PLAN_DIR_OVERRIDE`). `plan_task_path` takes `id: string` (mirroring `triage_results_path`), so `paths.ts` imports nothing from `plan_task.ts`.

**Key design decision — the evidence carries the full re-derivation signal.** The task's scope enumerated three raw fields (`diagnosis`/`resolution_stage`/`resolution_reason`), but `derive_fault_area` takes **four** inputs: it also consults `has_uncaptured_indexed_grep_hit` and `callers_only_in_unindexed_tests` on the diagnosis-fallback path (the coverage-gap and deterministic-extraction branches). The review (corroborated across the contracts, data, and cold-read lenses) confirmed that storing only the three fields makes the stated "area stays re-derivable" property false. The fix: `PlanTaskEvidence` carries exactly `derive_fault_area`'s `DeriveFaultAreaInput` — `diagnosis`, `resolution_failure: {stage,reason} | null`, and the two disambiguator booleans — so `derive_fault_area(evidence)` recomputes the area with no adapter. This aligns with TASK-190.22.9 AC#10, which threads those two booleans onto the published `NovelIssue` (closing the disambiguator-carry gap). `language` is omitted: 190.22.9 does not carry it upstream and it is an optional `derive_fault_area` input, so its absence is well-formed rather than a stored-but-unpopulatable field. Normalizing `resolution_failure` to `{...} | null` (vs `NovelIssue`'s optional) also makes the whole record total and removes the adapter at the derive call site.

## How the acceptance criteria are met

- **#1** `index.ts` barrel-exports `PlanTask`, `PlanTaskId`, `PlanTaskStatus`, `PlanTaskTier`, `PlanTaskEvidence`, `PlanSweepEvent`, and `PLAN_TASK_SCHEMA_VERSION`; `fault_area` is `AriadneFaultArea` imported from `@ariadnejs/types`; evidence composes the collapsed `MemberEvidence {file,line,why}` reused from `triage_results.ts`.
- **#2** `PlanTaskRepository` exports all seven methods; `PlanTaskQuery` supports all five filters.
- **#3** the three path helpers resolve under `~/.ariadne/plan/`, behind the lazy `ARIADNE_PLAN_DIR_OVERRIDE` read on every call; `paths.test.ts` proves the lazy override and the triage-base independence.
- **#4** type-only — every cross-module import is `import type`; no I/O, no `mcp__backlog`, no storage engine; `pnpm -r build`/`typecheck` green.
- **#5** the `dedup_key` doc-comment fixes its inputs (`fault_area` + sorted evidence `file:line` set), its immutability, and its exact-overlap-only scope.

## Review outcome

Ten opus reviewers (retuned for a type-only contract). Beyond the evidence-signal fix above, applied: the `dedup_key` doc now states the key is minted-once/immutable and resolves the "who computes the hash" ambiguity (engine computes; store matches the stored string); the `combine` sweep event is documented as supersede-fan-in (`merged_ids` → `status:"superseded"`, `superseded_by = into_id`) so it has a coherent record representation without a new field; `strategist`/sweep-id value spaces, the `PlanTaskEvidence`→`NovelIssue` projection, and a field-ownership note (engine populates; store persists + guards `schema_version`) were clarified; the barrel header order now matches the export order; the record/repository docs `{@link}` the path helpers; and the `paths.test.ts` "sibling" test was renamed to state what it actually proves (override independence). Noted-not-actioned: renaming `created_in_sweep`→`*_id` (honors the scope's literal names), splitting plan paths into their own module (scope directs them into `paths.ts`), and pinning a byte-exact cross-impl hash recipe (YAGNI — the swap-seam is sequential, and AC#5 only requires documenting the inputs). A follow-up note for 190.22.8: the store's `PlanTaskId` generator must exclude path separators, since `plan_task_path` does not sanitize (matching `triage_results_path`).

<!-- SECTION:NOTES:END -->
