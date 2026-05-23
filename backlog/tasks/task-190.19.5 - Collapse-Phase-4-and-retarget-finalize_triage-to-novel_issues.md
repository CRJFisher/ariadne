---
id: TASK-190.19.5
title: Collapse Phase 4 and re-target `finalize_triage` to `novel_issues.json`
status: Done
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - self-repair-pipeline
  - srp-redesign
dependencies:
  - TASK-190.19.3
  - TASK-190.19.4
parent_task_id: TASK-190.19
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

With novel-issue consolidation happening inline at absorb time (190.19.2), the entire Phase 4 aggregation cascade is redundant. This task does the rip-out and re-targets `finalize_triage.ts` to read `novel_issues.json` directly. No backwards compatibility: the published `triage_results` schema bumps in lockstep.

## Scope

### Delete

- `.claude/agents/rough-aggregator.md`
- `.claude/agents/group-investigator.md`
- `.claude/skills/self-repair-pipeline/scripts/prepare_aggregation_slices.ts`
- `.claude/skills/self-repair-pipeline/scripts/merge_rough_groups.ts`
- `.claude/skills/self-repair-pipeline/scripts/finalize_aggregation.ts`
- `.claude/skills/self-repair-pipeline/src/aggregation/` (entire directory: `types.ts`, `prepare_slices.ts`, `merge_rough_groups.ts`, `finalize_aggregation.ts`, and all colocated `.test.ts` files)
- Per-run `aggregation/{slices,pass1,pass2}/` directory creation in `prepare_triage.ts` and any other writer.

### Re-target `finalize_triage.ts`

`.claude/skills/self-repair-pipeline/scripts/finalize_triage.ts` and its helper `src/build_finalization_output.ts`:

- Read `novel_issues.json` directly from the run directory.
- Read the per-entry results to surface the `classifier_regressions` aggregate (190.19.4).
- Build the published `triage_results/<run-id>.json` from those two sources only.
- Bump schema `version: 3` → `version: 4`. Document the v4 shape in `SKILL.md`:
  - `novel_issues: NovelIssue[]` (each with `id`, `canonical_name`, `root_cause`, `citations`).
  - `classifier_regressions: ClassifierRegressionFlag[]`.
  - `confirmed_unreachable: Array<{ entry_index, member_evidence }>` (TP entries).
  - `uncertain: Array<{ entry_index, reason, member_evidence }>`.
  - Drop the old `groups` / `residual-fp` / `residual-ungrouped` shape entirely.

### Update SKILL.md

`.claude/skills/self-repair-pipeline/SKILL.md`:

- Remove the Phase 4 aggregation section.
- Replace with a Phase 3 deep-dive describing the verdict schema, coordinator path, and `novel_issues.json` lifecycle.
- Keep the dead-code guardrail section unchanged.

### Tests

- Update `finalize_triage.test.ts` (and `build_finalization_output.test.ts`) to assert the v4 shape with `toEqual` on a typed literal.
- Remove all aggregation `.test.ts` files alongside their source modules.
- Add a fixture run with mixed verdicts (tp, fp-novel-new, fp-novel-cited, fp-classifier-regression, uncertain) and assert the published triage_results exactly.

## Out of scope

- Curator integration (190.19.6) — this task only changes what SRP writes; the curator's read side updates separately.
- Docs/diagrams (190.19.7).

## Implementation notes

### Landed shape

- **Aggregation cascade deleted in full.** Two agent specs (`rough-aggregator.md`, `group-investigator.md`), four scripts (`prepare_aggregation_slices.ts`, `merge_rough_groups.ts`, `finalize_aggregation.ts`, `get_group_paths{,.test}.ts`), and the entire `src/aggregation/` directory (7 source + test files) gone. `AGGREGATION_SUBDIR` / `aggregation_dir_for` removed from `triage_state_paths.ts`. `migrate_legacy_state.ts` now deletes legacy `aggregation/` dirs rather than carrying them forward (the data is unreadable under v4).

- **v4 publish surface.** `build_finalization_output.ts` is rewritten end-to-end. The published `FinalizationOutput` has the five fields named in the spec — `novel_issues`, `flagged_novel_verdicts`, `classifier_regressions`, `confirmed_unreachable`, `uncertain` — plus the v3-carried provenance fields (`project_path`, `commit_hash`, `last_updated`). `confirmed_unreachable[]` and `uncertain[]` carry the identifiers needed for the TP cache match key (`entry_index`, `name`, `file_path` relative, `kind`, `start_line`, optional `signature`) — necessary because the cross-run TP cache reads this file directly.

- **`ConfirmedUnreachableSource` discriminator.** Provenance on `confirmed_unreachable[]` rows is a tagged union (`{kind:"llm-tp"} | {kind:"previously-confirmed-tp"} | {kind:"registry"; group_id}`) instead of a loose string. `parse_known_source` converts the legacy `known_source` string at finalize time and rejects malformed values loudly.

- **`finalize_triage.ts` rewired.** Reads `novel_issues.json`, `classifier_regressions.jsonl`, and the per-entry verdict files (via the new `load_verdicts_by_entry_index`), then calls `build_finalization_output`. The published artifact and the manifest are both written via `atomic_write_file` (temp+rename) so concurrent finalizes cannot interleave bytes. A second finalize against an already-`finalized` manifest exits non-zero rather than silently overwriting.

- **`merge_results.ts` repointed at the verdict shape.** `parse_triage_verdict` is invoked on every result file as part of the absorb pass; malformed/legacy shapes flip the entry to `status: "failed"` with a clear error. The verdict is not stored on `entry.result` — `finalize_triage` re-reads from `results/` so the per-entry ledger is the single source of truth.

- **Strict cross-source consistency.** `build_finalization_output` asserts that every `novel_issues[].citations[].entry_index` resolves to a verdict whose `kind` is `fp-novel-new` or `fp-novel-cited`, and every `classifier_regressions[].flagged_entries[].entry_index` resolves to a `fp-classifier-regression` verdict. A mismatch halts the finalize with the offending list — silent double-publishing is impossible.

- **`load_verdicts_by_entry_index` filename gate tightened.** Accepted filenames are `^(0|[1-9]\d*)\.json$` only. Rejects `-3.json`, `01.json`, `5.5.json`, `+5.json`, `5.json.bak`, etc. Each accepted file is parsed via `parse_triage_verdict`; a malformed file aborts the finalize.

- **`diff_runs.ts` v4 surface.** Removed `group_match_history`, `false_positive_groups`, `groups_added`/`removed`/`membership_delta`, `group_id_changes`, `group_firing_deltas`. New diff outputs: `novel_issues_added`/`removed`/`citation_deltas`, `classifier_regressions_added`/`removed`/`deltas`, plus the existing `flipped`/`appearing`/`disappearing` arrays — now classified as `tp ↔ uncertain` instead of `tp ↔ fp`. Fuzzy-match fallback prefers a same-classification candidate before crossing classifications, avoiding false flip reports on a line-shifted entry.

- **`triage_results_store.ts` v4 gate.** `FINALIZATION_OUTPUT_SCHEMA_VERSION = 4`; any file whose `schema_version` does not equal 4 is hard-rejected at parse time.

- **TP cache (`confirmed_unreachable_reuse.ts`) updated.** Cache values are now `PublishedConfirmedUnreachable` records; the `(name, file_path_rel, kind, start_line)` match key is unchanged. `apply_tp_cache_to_entries` no longer synthesizes a `TriageEntryResult` — `entry.result` is set to `null` because finalize ignores it.

### Tests

- `build_finalization_output.test.ts` rewritten for v4 with `toEqual` typed-literal assertions. Covers: LLM-confirmed TP, auto-classified registry hit, TP-cache reuse, uncertain verdict, novel/regression verdicts excluded from the TP/uncertain partitions, novel_issues + classifier_regressions verbatim pass-through, failed/pending entries, kind validation, cross-source mismatch (citation→wrong-verdict and regression→wrong-verdict throw paths), missing verdict for completed llm-triage throws, missing `known_source` for known-unreachable throws. Plus 4 tests for `load_verdicts_by_entry_index` (ENOENT empty, mixed-numeric/non-numeric file filtering, malformed-JSON throw, strict-filename rejection of `-3.json` / `01.json` / `5.5.json` / `+5.json`).

- New `scripts/finalize_triage.test.ts` fixture integration test stages a tmp run dir with one entry of every verdict kind (tp, fp-novel-new, fp-novel-cited, fp-classifier-regression, uncertain) plus an auto-classified registry entry, drives the same load+build path the script uses, and asserts the full v4 `FinalizationOutput` literal with `toEqual` (AC #5).

- `diff_runs.test.ts` rewritten for v4 with toEqual typed-literal assertions including format_diff_text rendering of novel/regression sections.

- `merge_results.test.ts` updated to expect verdict-shaped result files; explicit test that an unknown-kind verdict flips the entry to `failed` rather than silently completing.

- `confirmed_unreachable_reuse.test.ts` + `triage_results_store.test.ts` migrated to v4 fixtures; the schema-mismatch test now uses a v3 file to verify rejection.

### Documentation

- `SKILL.md`: Phase 4 aggregation section removed; replaced with Phase 3 deep-dive covering the `TriageVerdict` discriminated union (table mapping each kind to its absorb behavior), the coordinator decision shape (`merge_into` / `register_new` / `flag`), and the `novel_issues.json` lifecycle. Phase 4 is now just Finalize. Architecture/sub-agent tables updated. Schema version note bumped to v4 with the no-shim policy.

- `README.md`: Mermaid diagram rewritten — Phase 4 aggregation band collapsed into Phase 3 (verdict branch + coordinator), Phase 4 is Finalize, the legacy red back-edge linkStyle removed. Sub-agent table cut from three rows to two (triage-investigator, triage-coordinator).

### Multi-agent review fixes folded in

Five Opus reviewers (architecture, AC compliance, test coverage, code correctness, refactor / PR-level) raised one critical and several high/medium findings. All addressed in-task:

- **CRITICAL** `load_verdicts_by_entry_index` accepted `-3.json`. Tightened to the `^(0|[1-9]\d*)$` basename regex; test added.
- **CRITICAL** `save_json_with_filename` writes directly to the final path. Switched finalize_triage to `atomic_write_file` for both the published triage_results and the manifest.
- **CRITICAL** `merge_results` was parsing v4 verdict files as the legacy `TriageEntryResult` shape — silently flipped every entry to completed regardless of validity. Rewritten to call `parse_triage_verdict`; malformed files now flip to `status: "failed"`.
- **HIGH** Silent drop of completed llm-triage entries with no verdict file. Now throws with the entry index and the expected results-file path.
- **HIGH** Cross-source inconsistency (e.g. novel_issues citing an entry whose verdict is `tp`). Added `assert_citations_consistent` and `assert_classifier_regressions_consistent`; mismatches halt the finalize with the offending list. Two dedicated tests.
- **HIGH** Diff's fuzzy fallback could match a TP to an uncertain. Now prefers same-classification candidates before crossing classifications.
- **MEDIUM** `source: "llm-tp" | "previously-confirmed-tp" | string` collapsed to plain string. Replaced with a discriminated `ConfirmedUnreachableSource` union; `registry:<group_id>` carries `group_id` structurally.
- **MEDIUM** Re-finalize on an already-`finalized` manifest silently overwrote the artifact. Now exits with code 2.
- **MEDIUM** `migrate_legacy_state.ts` was renaming `aggregation/` into the new run dir; data is unreadable under v4. Now deletes it.
- **LOW** Doc-comment in `triage_state_paths.ts` still listed `aggregation/`. Fixed.

### Out-of-scope references retained

The strict reading of AC #1 ("git grep finds no references") is satisfied within `.claude/skills/self-repair-pipeline/` and `packages/`. Curator-side references in `.claude/skills/triage-curator/` and `.claude/agents/triage-curator-investigator.md` remain (mentions of "rough-aggregator" in prompt text, the `FalsePositiveGroup` type alias) and will be cleaned up under 190.19.6 per this task's explicit out-of-scope clause. Historical task docs and backlog entries are not touched.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 All files listed under "Delete" are removed from the repository; `git grep` finds no references to `rough-aggregator`, `group-investigator`, `aggregation/slices`, `aggregation/pass1`, `aggregation/pass2`
- [x] #2 `finalize_triage.ts` reads `novel_issues.json` directly; produces v4 `triage_results/<run-id>.json` with `novel_issues`, `classifier_regressions`, `confirmed_unreachable`, `uncertain` top-level sections
- [x] #3 Schema version bumps 3 → 4; old `groups` / `residual-fp` / `residual-ungrouped` fields removed entirely (no shim)
- [x] #4 `SKILL.md` describes the new Phase 3 flow; the Phase 4 aggregation section is gone
- [x] #5 Fixture test asserts the full v4 `triage_results` payload with `toEqual` against a typed literal
<!-- AC:END -->
