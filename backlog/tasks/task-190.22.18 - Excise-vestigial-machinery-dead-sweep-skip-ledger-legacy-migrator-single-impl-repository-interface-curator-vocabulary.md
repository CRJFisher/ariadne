---
id: TASK-190.22.18
title: >-
  Excise vestigial machinery: dead sweep-skip ledger, legacy migrator,
  single-impl repository interface, curator vocabulary
status: To Do
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

- [ ] #1 No code or doc under .claude/skills/ or packages/skill-\* references curator vocabulary, CURATOR_RUNS_DIR, the triage-curator on-disk namespace, finalized.json/finalize_started.json markers, or migrate_legacy_state (grep-clean apart from git history and archived backlog docs)
- [ ] #2 PlanTaskRepository interface no longer exists; all callers type against the concrete JSON store; PlanTaskQuery and PlanSweepEvent survive
- [ ] #3 plan/SKILL.md and skill-protocol/src/plan_task.ts contain no speculative multi-target adapter or downstream-ranker prose
- [ ] #4 src/propose/ no longer exists as a folder name that matches no pipeline pass; validate_plan lives with the pass it gates; render_unsupported_features either has a verified caller and an honest home, or is deleted
- [ ] #5 All four pipeline test suites (triage, plan, skill-fs, skill-protocol) pass after the excision; file moves preserve history via git mv
<!-- AC:END -->
