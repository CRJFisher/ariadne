---
id: TASK-190.22.18
title: >-
  Excise vestigial machinery: dead sweep-skip ledger, legacy migrator,
  single-impl repository interface, curator vocabulary
status: Done
assignee: []
created_date: "2026-06-09 20:05"
labels:
  - self-repair
  - refactor
dependencies: []
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Residue from the removed fix-delivery/curator design survives in the pipeline. Per the constitution (no backwards compatibility, no transitional layers, YAGNI), each item below is pure subtraction with a comprehension payoff: a reader grepping for the removed curator currently finds live code.

## Scope (verified findings)

1. **Dead sweep-skip ledger — delete.** `plan/src/store/scan_runs.ts` (~62–86) skips runs carrying `finalized.json`/`finalize_started.json` markers under `CURATOR_RUNS_DIR` (`plan/src/store/paths.ts` ~15–20, on-disk `~/.ariadne/triage-curator/`). Verified: nothing in the repo writes those markers, and the directory does not exist on disk — `list_curated_run_ids` always returns the empty set. Delete `list_curated_run_ids`, the skip branch in `filter_uncurated`, and `CURATOR_RUNS_DIR`. Reconcile-by-`dedup_key` is the real idempotency mechanism.

2. **Legacy migrator — delete.** `triage/scripts/migrate_legacy_state.ts` migrates a pre-v4 flat layout (references a removed "aggregation cascade"). Delete the script, its two `triage/SKILL.md` sections (~309–321 and the "Migrate" persisted-state table row ~331), and the paired legacy-state warning in `prepare_triage`.

3. **Single-impl repository interface — collapse.** `packages/skill-protocol/src/plan_task_repository.ts` exists for a hypothetical "SQLite/vector store drop-in"; `plan/src/store/json_plan_task_repository.ts` is the only implementation, and tests isolate via `ARIADNE_PLAN_DIR_OVERRIDE`, not fake repos. Delete the interface; type callers against the concrete store. Keep `PlanTaskQuery`/`PlanSweepEvent` (real data shapes). Since triage never touches `PlanTask`, consider moving `plan_task*` types from skill-protocol into the plan skill.

4. **Curator vocabulary — rename to sweep vocabulary.** Identifiers: `list_curated_run_ids`→(deleted per item 1), `filter_uncurated`→`filter_unswept`, test tmp prefixes. Prose: `triage/SKILL.md:243` ("the curator depends on it" → the plan skill), `:371` (`aggregate_classifier_regressions` "shared with the curator" — it is used only by triage's finalize; also fix the `skill-fs/classifier_regressions.ts` header), `.claude/agents/triage-investigator.md:94–95` ("the curator's surface" → the human's surface), and code comments in `prune_runs.ts:8`, `finalize_triage.ts:81`, `prepare_triage.ts:243`, `detect_entrypoints.ts:459`, `diff_runs.ts:9`, `known_issues_registry.ts` (`validate_optional_curator_fields`).

5. **Speculative prose — delete.** The `export_to_linear.ts`/`export_to_github_issues.ts` "swappable adapter seam" framing in `plan/SKILL.md` (~167–173); trim the hypothetical "downstream ranker" paragraphs in `skill-protocol/src/plan_task.ts` to the one sentence true today (fields stay — `prioritize --priority` uses them).

6. **`src/propose/` folder does not map to any named pass.** Move `validate_plan.ts` beside `reconcile/` (it gates reconcile); `impact_report.ts` is standalone registry tooling — give it an honest home. Verify `scripts/render_unsupported_features.ts` has a real caller (no SKILL.md references it); if only its test keeps it alive, delete or relocate to core tooling. Use `git mv` for moves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 No code or doc under .claude/skills/ or packages/skill-\* references curator vocabulary, CURATOR_RUNS_DIR, the triage-curator on-disk namespace, finalized.json/finalize_started.json markers, or migrate_legacy_state (grep-clean apart from git history and archived backlog docs)
- [x] #2 PlanTaskRepository interface no longer exists; all callers type against the concrete JSON store; PlanTaskQuery and PlanSweepEvent survive
- [x] #3 plan/SKILL.md and skill-protocol/src/plan_task.ts contain no speculative multi-target adapter or downstream-ranker prose
- [x] #4 src/propose/ no longer exists as a folder name that matches no pipeline pass; validate_plan lives with the pass it gates; render_unsupported_features either has a verified caller and an honest home, or is deleted
- [x] #5 All four pipeline test suites (triage, plan, skill-fs, skill-protocol) pass after the excision; file moves preserve history via git mv
<!-- AC:END -->

## Implementation Notes

## High-level summary

The pipeline now carries no residue of the removed fix-delivery/curator design. A reader grepping `.claude/skills/` and `packages/skill-*` for `curator`, `CURATOR_RUNS_DIR`, the `triage-curator` namespace, the `finalized.json`/`finalize_started.json` markers, or `migrate_legacy_state` finds nothing live — and the same is true repo-wide once the shared `@ariadnejs/types` registry contract and the `file_naming` hook are swept too. `@ariadnejs/skill-protocol` now holds only the genuine triage→plan seam (`run_id`, the published `triage_results` wire schema, and the triage/registry path resolvers); the plan engine's task-DB record, store query/event types, and `~/.ariadne/plan/` path helpers live inside the plan skill where the only consumers are. The plan `src/` layout reads as its pipeline passes — `group/` → `reconcile/` → `export/` over `store/` — with no folder that maps to no pass.

### What changed

- **Dead sweep-skip ledger — deleted.** `list_curated_run_ids`, `CURATOR_RUNS_DIR`, and the skip branch are gone from `scan_runs.ts`/`paths.ts`. The ledger always returned the empty set (nothing wrote its markers, the directory never existed), so removing it changes no behavior; reconcile-by-`dedup_key` is the real idempotency mechanism. The surviving filter is renamed `filter_uncurated` → **`apply_scan_filters`** (see deviations).
- **Legacy migrator — deleted.** `migrate_legacy_state.ts`, `warn_about_legacy_state` + its call in `prepare_triage.ts`, the unused `TRIAGE_STATE_DIR` import, the `triage/SKILL.md` migration section + persisted-state table row, and the stale upgrade-step in the pending changeset.
- **`PlanTaskRepository` interface — collapsed.** The single-impl interface is deleted; `reconcile_plan.ts` and `record_membership_decisions.ts` type their `repo` parameter against the concrete `JsonPlanTaskRepository`. `PlanTaskQuery` and `PlanSweepEvent` survive, folded into `plan_task.ts` beside the record they belong to.
- **Types + path helpers moved into the plan skill.** `plan_task.ts` (record contract + `PlanTaskQuery`/`PlanSweepEvent`) moved via `git mv` to `src/store/plan_task.ts`; the plan-only `plan_dir`/`plan_tasks_dir`/`plan_task_path`/`plan_sweeps_dir`/`plan_membership_overrides_path` helpers moved to `src/store/paths.ts`, with their tests. Verified zero consumers outside the plan skill.
- **Curator → sweep/registry/human vocabulary.** Every prose, comment, and identifier site renamed: `validate_optional_curator_fields` → `validate_optional_rollup_fields`; the `classifier_regressions.ts` header, `triage-investigator.md`, `diff_runs`/`prune_runs`/`finalize_triage`/`prepare_triage`/`detect_entrypoints` comments, the `registry_writers.test.ts` writer-set header, the `known_issues.ts` registry-field docs, and the `file_naming.ts` hook comment.
- **Speculative prose — deleted.** The swappable-adapter-seam paragraph in `plan/SKILL.md`, the `export_to_backlog.ts` "family of targets" header framing, and the downstream-ranker paragraphs in `plan_task.ts`, `get_bucket_context.ts`, and `plan-strategist.md`. The cost/benefit fields stay; their prose now states the truth (the user weighs cost against the benefit rollups when promoting work; `export_to_backlog --priority` selects the core/classifier partition).
- **`src/propose/` — dissolved.** `validate_plan` (gates reconcile) and `render_task` (reconcile mint-time feedstock) `git mv`'d into `reconcile/`. `impact_report` and `render_unsupported_features` were deleted entirely (see decisions), so nothing else needed a home.

### Decisions recorded (override the doc's "consider" language)

These were confirmed with the user before implementation:

1. **`plan_task*` types moved into the plan skill** (not kept in skill-protocol). The path helpers moved alongside them — they are equally plan-only, so leaving them in the shared-seam package would be the same misplacement this task excises.
2. **`impact_report` machinery deleted, not relocated** — `impact_report.ts`, `generate_impact_report.ts`, the `packages/types/src/impact_report.ts` orphan (`ImpactRow`/`ImpactReportFile`), the `plan/SKILL.md` section, and the `meta.json` flow. It was on-demand human tooling with no sweep consumer; deletion is the YAGNI call.
3. **`render_unsupported_features` deleted** with its four generated `packages/core/.../queries/unsupported_features.{lang}.md` docs — no code reads those `.md` files (the query loader reads `.scm`).

### Naming deviations from the doc

- `filter_uncurated` → **`apply_scan_filters`** (the doc said `filter_unswept`). Once the ledger is gone the function no longer filters by swept-ness — it only applies `--project`/`--last` — so `filter_unswept` would be a fresh misnomer.
- `validate_optional_curator_fields` → **`validate_optional_rollup_fields`** (the doc said `_sweep_`). It validates the `observed_count`/`observed_projects`/`last_seen_run` rollups; the plan sweep never writes the registry, so "sweep" would be inaccurate.

### Deliberately out of scope

The `registry-read` surface (`meta.json` store, `plan/SKILL.md` State bullet, the `README.per-step.mmd` REG node) is now arguably stale — after deleting the two on-demand registry-reading scripts, no plan code reads the registry. It is left untouched here: removing it would also require reconciling `classifier-lifecycle.md` ("plan reads it to ground its planning") and re-rendering a diagram, and the doc-correction concern is already tracked by TASK-190.22.19.

### Verification

`pnpm build`, `pnpm typecheck`, and `pnpm lint` are clean. All four pipeline suites pass (plan 179, triage 265, skill-fs 17, skill-protocol 16) plus types 130 and core 2811. File moves are recorded as renames (`git show --stat`), preserving history.
