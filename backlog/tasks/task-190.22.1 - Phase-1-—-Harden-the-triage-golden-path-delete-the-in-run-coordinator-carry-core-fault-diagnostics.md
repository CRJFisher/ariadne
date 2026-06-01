---
id: TASK-190.22.1
title: >-
  Phase 1 — Harden the triage golden path; delete the in-run coordinator; carry
  core fault diagnostics
status: To Do
assignee: []
created_date: '2026-06-01 10:45'
updated_date: '2026-06-01 14:52'
labels:
  - self-repair
  - triage
  - golden-path
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Today `triage-entrypoints` cannot publish usable false-positive signal. Two problems: (1) the in-run coordinator that was meant to write `novel_issues.json` (`src/absorb/*`, built in TASK-190.19, May 23) was never wired to a dispatcher, so `finalize` publishes an empty `novel_issues[]` even when investigators emit `fp-novel-*` verdicts; (2) the *deterministic* fault signal Ariadne core emits per call site (`diagnosis` enum + `resolution_failure.reason`/`receiver_kind`) is computed but STRIPPED at finalize, so a downstream planner can never see "which part of Ariadne is at fault". The golden path must publish each false-positive **raw and self-contained**, carrying the deterministic fault diagnostics, and the unwired coordinator must be **deleted** (offline grouping in `plan` subsumes it — no parking).

## Scope — unify + enrich the false-positive verdict

- `src/verdict/triage_verdict.ts` — collapse `fp-novel-new` + `fp-novel-cited` into ONE self-contained `fp-novel` verdict kind. `fp-novel-cited` existed only for in-run citation against the coordinator's snapshot; with the coordinator gone it has no purpose. Every FP verdict must carry its own `member_evidence {file,line,why}` + `proposed_root_cause` (free-text) so it stands alone for offline grouping. Keep `fp-classifier-regression` (it cites a registry `rule_id`).
- **Carry the deterministic core fault diagnostics onto each published FP verdict** — `diagnosis` (the 4-value enum from `EntryPointDiagnostics`) and `resolution_failure` (`{ stage, reason }` from `CallReference.resolution_failure`, plus `receiver_kind` where present). These already exist in `@ariadnejs/types` (`call_chains.ts`, `entry_point.ts`) and are surfaced by `extract_entry_point_diagnostics.ts` but dropped at finalize. This is the standardised "which part of Ariadne is at fault" signal — real data, not an invented taxonomy. The `AriadneFaultArea` derivation that consumes this signal is authored in TASK-190.22.4 (computed-on-read, not stored here).

## Scope — collect raw FP signal at finalize (lands with the verdict change)

- `src/finalize/output.ts` — `build_finalization_output` builds `novel_issues[]` directly from the `fp-novel` verdict files (one per verdict, deterministic id keyed by `entry_index`; NO merge), each carrying `member_evidence`, `proposed_root_cause`, and the deterministic `diagnosis`/`resolution_failure`. Stop stripping the diagnostics. Drop `novel_issues`/`flagged_novel_verdicts` as *inputs* to `FinalizationSources`; delete `assert_citations_consistent` (`output.ts:304-330`) — replace with a unit test asserting every published FP row has a backing verdict.
- `scripts/finalize_triage.ts` — stop importing/reading `novel_issues.json` (`:31,72,84-89`); keep the `classifier_regressions` + `verdicts_by_entry_index` reads.

## Scope — DELETE the in-run coordinator (no parking)

- `git rm` `src/absorb/{absorb_verdict,coordinator_decision,coordinator_apply_decision,coordinator_prompt,coordinator_log}.ts` + colocated tests; delete `src/write_boundary.test.ts` (its only assertion is the coordinator tool-allowlist; the registry write-boundary lives in `packages/skill-fs/src/registry_writers.test.ts`).
- Relocate the `NovelIssue`/`NovelIssueCitation`/`MemberEvidence` types out of `src/absorb/novel_issues.ts` (finalize's only real dependency). In Phase 1 keep them locally (e.g. alongside `triage_verdict.ts`); Phase 2 moves them into `@ariadnejs/skill-protocol`. Then `git rm` `novel_issues.ts`.
- `git rm .claude/agents/triage-coordinator.md`; remove `COORDINATOR_LOG_FILENAME`/`coordinator_log_path_for` + `novel_issues.json` path helpers from `src/store/paths.ts` and their `paths.test.ts` assertions.
- `src/dispense/dispense_payload.ts` + `scripts/get_entry_context.ts` + `templates/prompt.md` — remove the `novel_issues_snapshot` field/substitution entirely.
- `.claude/agents/triage-investigator.md` — delete the in-run `fp-novel-cited` snapshot early-exit (`:34-57`); keep the registry-driven `fp-classifier-regression` early-exit (`:71-79`). Investigators early-exit only on REGISTRY matches.
- `SKILL.md` — remove `Task(triage-coordinator)` from `allowed-tools` (`:6`), the coordinator from the Phase-3 row / Sub-Agents table / Verdict-schema prose (`:215-241`), and the `novel_issues.json`/`coordinator_log.jsonl` run-state rows.
- `scripts/get_next_triage_entry.ts` / `src/finalize/merge_results.ts` — NO functional change (already parse-and-mark-completed).

## Tests

Update colocated `output.test.ts` (build-from-verdict cases incl. the new diagnostics fields; delete cross-source-mismatch case), `triage_verdict.test.ts` (unified `fp-novel` + diagnostics), `finalize_triage.test.ts`, `dispense_payload.test.ts`, `get_entry_context.test.ts`. Delete tests for removed absorb modules.

## End-to-end verification

With `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE=~/.ariadne/self-repair-pipeline`, run `detect_entrypoints → prepare_triage (--max-count 10) → get_next_triage_entry loop → finalize_triage` against a real cloned repo (e.g. `~/.ariadne/self-repair-pipeline/repos/expressjs--express`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The FP verdict is unified to a single self-contained `fp-novel` kind (`fp-novel-cited` removed); every FP verdict carries its own `member_evidence {file,line,why}` + free-text `proposed_root_cause`
- [ ] #2 Each published FP row carries the deterministic core fault diagnostics — `diagnosis` + `resolution_failure {stage,reason}` (and `receiver_kind` where present) — imported from `@ariadnejs/types`; finalize no longer strips them. The `AriadneFaultArea` derivation that consumes this signal is authored in TASK-190.22.4
- [ ] #3 `build_finalization_output` builds `novel_issues[]` from `fp-novel` verdict files (one per verdict, no merge); `finalize_triage.ts` no longer reads `novel_issues.json`; a finalized run publishes a non-empty `novel_issues[]` with NO `novel_issues.json` written
- [ ] #4 The in-run coordinator is DELETED (not parked): `src/absorb/{absorb_verdict,coordinator_*}.ts` + tests, `src/write_boundary.test.ts`, `.claude/agents/triage-coordinator.md`, and the `coordinator_log.jsonl`/`novel_issues.json` path helpers are removed; no `Task(triage-coordinator)` grant remains
- [ ] #5 `NovelIssue`/`NovelIssueCitation`/`MemberEvidence` types are relocated out of the deleted `novel_issues.ts` (locally in P1; to `@ariadnejs/skill-protocol` in P2); the build is clean with no dangling imports
- [ ] #6 The `novel_issues_snapshot` is removed from the dispense payload, `get_entry_context.ts`, and `templates/prompt.md`; the investigator early-exits only on registry matches
- [ ] #7 `assert_citations_consistent` removed and replaced by a unit test asserting every published FP row has a backing verdict
- [ ] #8 End-to-end run on a real cloned repo publishes `triage_results/<run-id>.json` with `schema_version` bumped, a `tp` in `confirmed_unreachable[]`, and `novel_issues[]` rows that include the deterministic `diagnosis`/`resolution_failure` signal
- [ ] #9 Colocated tests updated; removed-module tests deleted; `pnpm test`/skill `vitest` green
<!-- AC:END -->
