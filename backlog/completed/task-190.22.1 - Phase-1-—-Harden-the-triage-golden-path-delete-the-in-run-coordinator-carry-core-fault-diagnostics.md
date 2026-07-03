---
id: TASK-190.22.1
title: >-
  Phase 1 — Harden the triage golden path; delete the in-run coordinator; carry
  core fault diagnostics
status: Done
assignee: []
created_date: '2026-06-01 10:45'
updated_date: '2026-06-02'
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

Today `triage-entrypoints` cannot publish usable false-positive signal. Three problems:

1. **The in-run coordinator is dead code.** `src/absorb/absorb_verdict.ts` (the dispatcher meant to absorb verdicts into `novel_issues.json`, built in TASK-190.19, May 23) is **never called from any script** — only from its own tests — and the `triage-coordinator` sub-agent it would invoke was never wired up. Investigators write verdict files to `results/<entry_index>.json` directly; nothing absorbs them. So at finalize, `novel_issues.json` is read but is always empty.
2. **The same dead dispatcher is the only writer of `classifier_regressions.jsonl`** — so that finalize read is *also* always empty today.
3. **Deterministic core fault signal is dropped.** Ariadne core computes, per entry, `EntryPointDiagnostics.diagnosis` (a 4-value enum) and per-call-site `resolution_failure {stage, reason}` + `receiver_kind` (`packages/types/src/{entry_point.ts,call_chains.ts}`, surfaced by `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts`). This is the standardised "which part of Ariadne is at fault" signal the downstream `plan` skill groups on — but finalize never copies it onto the output.

The golden path must publish each false-positive **raw and self-contained**, carrying the deterministic fault diagnostics, and the unwired coordinator must be **deleted** (offline grouping in `plan` subsumes it — no parking). Because the dead dispatcher was the sole writer of both in-run absorb files, finalize **derives both `novel_issues[]` and `classifier_regressions[]` from the verdict files** in `results/`, and the in-run absorb files (`novel_issues.json`, `classifier_regressions.jsonl`, `coordinator_log.jsonl`) are removed entirely. `verdicts_by_entry_index` is already loaded at finalize directly from `results/` via `load_verdicts_by_entry_index` (`src/finalize/verdict_ledger.ts`) — this is the single source of truth the new finalize builds from.

## Scope — unify + enrich the false-positive verdict

- `src/verdict/triage_verdict.ts` — collapse `fp-novel-new` + `fp-novel-cited` into ONE self-contained `fp-novel` verdict kind. `fp-novel-cited` existed only for in-run citation against the coordinator's snapshot; with the coordinator gone it has no purpose. Every FP verdict must carry its own `member_evidence {file,line,why}` + `proposed_root_cause` (free-text) + `evidence_excerpt` so it stands alone for offline grouping. Keep `fp-classifier-regression` (it also cites a registry `should_have_matched_rule_id`). Delete the `NovelVerdict` union and its helpers `expect_novel_verdict`/`parse_novel_verdict` (they only narrowed to the now-merged cited/new kinds); update `parse_triage_verdict` to the new union.
- **Carry the deterministic core fault diagnostics onto each published FP row.** These are *deterministic core signal*, not investigator-authored, so they are **attached at finalize from the entry**, not emitted in the verdict. For each FP row attach `diagnosis` (the 4-value enum `EntryPointDiagnostics["diagnosis"]`) and `resolution_failure` (`{ stage, reason }` from the failing `CallRefDiagnostic.resolution_failure`, plus `receiver_kind` where the call site is a method). Select the call ref with a non-null `resolution_failure`; if none, omit `resolution_failure` but still emit `diagnosis`. Import these types from `@ariadnejs/types` — real data, not an invented taxonomy. The `AriadneFaultArea` derivation that consumes this signal is authored in TASK-190.22.3 (computed-on-read, not stored here).
- **Implementer check (gates the finalize work):** confirm `EntryPointDiagnostics` is threaded onto `TriageEntry` through `prepare_triage` into `TriageState` so it is reachable inside `build_finalization_output`. If it is not currently threaded, thread it (it already exists on the detect output) — that threading **is** the "stop dropping at finalize" fix.

## Scope — collect raw FP signal at finalize (lands with the verdict change)

- `src/finalize/output.ts` — `build_finalization_output` builds `novel_issues[]` directly from the `fp-novel` verdict files in `verdicts_by_entry_index` (one per verdict, deterministic id keyed by `entry_index`; NO merge), each carrying `member_evidence`, `proposed_root_cause`, `evidence_excerpt`, and the attached `diagnosis`/`resolution_failure`/`receiver_kind`. It **also derives `classifier_regressions[]`** by aggregating the `fp-classifier-regression` verdicts from the same map (per-rule rollup keyed on `should_have_matched_rule_id`), replacing the `classifier_regressions.jsonl` read. Drop `novel_issues`/`flagged_novel_verdicts` as *inputs* to `FinalizationSources` (it shrinks to `verdicts_by_entry_index` plus entry/diagnostics access); delete `assert_citations_consistent` (`output.ts:304-330`) — replace with a unit test asserting every published FP row has a backing verdict. Bump `FINALIZATION_OUTPUT_SCHEMA_VERSION` 4 → 5. Redefine the published `NovelIssue` to the new self-contained row (`id`, `entry_index`, `member_evidence`, `proposed_root_cause`, `evidence_excerpt`, `diagnosis`, `resolution_failure?`, `receiver_kind?`); drop `NovelIssueCitation` (a coordinator concept — no citation list in the one-per-verdict model; YAGNI) unless a surviving reference needs it.
- `scripts/finalize_triage.ts` — stop importing/reading `novel_issues.json` (`:31,72,84-89`) **and** `classifier_regressions.jsonl`; load only `verdicts_by_entry_index` from `results/` and pass it through.

## Scope — DELETE the in-run coordinator (no parking)

- `git rm` `src/absorb/{absorb_verdict,coordinator_decision,coordinator_apply_decision,coordinator_prompt,coordinator_log}.ts` + colocated tests; delete `src/write_boundary.test.ts` (its only assertion is the coordinator tool-allowlist; the registry write-boundary lives in `packages/skill-fs/src/registry_writers.test.ts`).
- Relocate the surviving `NovelIssue` type (in its new finalize shape) out of `src/absorb/novel_issues.ts` (finalize's only real dependency). In Phase 1 keep it locally alongside `src/verdict/triage_verdict.ts` (`MemberEvidence` already lives there); Phase 2 moves it into `@ariadnejs/skill-protocol`. Then `git rm` `novel_issues.ts`.
- `git rm .claude/agents/triage-coordinator.md`; remove `COORDINATOR_LOG_FILENAME`/`coordinator_log_path_for`, `NOVEL_ISSUES_FILENAME`/`novel_issues_path_for`, and the `classifier_regressions.jsonl` path helper from `src/store/paths.ts` (nothing reads/writes these files now); update the layout comment and the `paths.test.ts` assertions.
- `src/dispense/dispense_payload.ts` + `scripts/get_entry_context.ts` + `templates/prompt.md` — remove the `novel_issues_snapshot` field/substitution/prompt section entirely.
- `.claude/agents/triage-investigator.md` — delete the in-run `fp-novel-cited` snapshot early-exit (`:43-57`); rename the `fp-novel-new` emission to the unified `fp-novel` kind; keep the registry-driven `fp-classifier-regression` early-exit (`:71-78`). Investigators early-exit only on REGISTRY matches.
- `SKILL.md` — remove `Task(triage-coordinator)` from `allowed-tools` (`:6`) and the "via a coordinator" clause from the description; delete the "Coordinator path" section (`:225-235`) and the `novel_issues.json` lifecycle section (`:237-241`); update the Verdict-schema table (`:215-221`) to the unified `fp-novel` row built-from-verdict-files at finalize; remove the `novel_issues.json`/`classifier_regressions.jsonl`/`coordinator_log.jsonl` run-state rows (`:97-99`) and the `absorb_verdict.ts` architecture-table row (`:396`).
- `scripts/get_next_triage_entry.ts` / `src/finalize/merge_results.ts` — NO functional change (already parse-and-mark-completed; verified).

## Tests

Update colocated `output.test.ts` (build-from-verdict cases incl. the new `diagnosis`/`resolution_failure` fields and the derived `classifier_regressions[]`; delete the cross-source-mismatch / citation-consistency cases; add the "every published FP row has a backing verdict" assertion), `triage_verdict.test.ts` (unified `fp-novel`; delete `fp-novel-cited` + `NovelVerdict` cases), `finalize_triage.test.ts` (drop the `novel_issues.json`/`classifier_regressions.jsonl` fixtures; assert both slices are derived from `results/`), `dispense_payload.test.ts` + `get_entry_context.test.ts` (drop `novel_issues_snapshot` cases), `paths.test.ts` (drop coordinator/novel_issues path assertions). Delete all `src/absorb/*.test.ts`. Per CLAUDE.md: `toEqual` with typed literals (never `toMatchObject`), exact-value assertions.

## End-to-end verification

With `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE=~/.ariadne/self-repair-pipeline`, run `detect_entrypoints → prepare_triage (--max-count 10) → get_next_triage_entry loop → finalize_triage` against a real cloned repo (e.g. `~/.ariadne/self-repair-pipeline/repos/expressjs--express`). Assert the published `triage_results/<run-id>.json` has `schema_version` `5`, a `tp` in `confirmed_unreachable[]`, a non-empty `novel_issues[]` whose rows carry `member_evidence` + `proposed_root_cause` + the deterministic `diagnosis`/`resolution_failure`, and that NO `novel_issues.json`, `classifier_regressions.jsonl`, or `coordinator_log.jsonl` is written under the run dir.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The FP verdict is unified to a single self-contained `fp-novel` kind (`fp-novel-cited` removed); every FP verdict carries its own `member_evidence {file,line,why}` + free-text `proposed_root_cause`
- [x] #2 Each published FP row carries the deterministic core fault diagnostics — `diagnosis` + `resolution_failure {stage,reason}` (and `receiver_kind` where present) — imported from `@ariadnejs/types` and attached at finalize from the entry's `EntryPointDiagnostics`; finalize no longer strips them. The `AriadneFaultArea` derivation that consumes this signal is authored in TASK-190.22.3
- [x] #3 `build_finalization_output` builds `novel_issues[]` from `fp-novel` verdict files (one per verdict, no merge) AND derives `classifier_regressions[]` from the `fp-classifier-regression` verdict files; `finalize_triage.ts` no longer reads `novel_issues.json` or `classifier_regressions.jsonl`; a finalized run publishes a non-empty `novel_issues[]` with NO `novel_issues.json`/`classifier_regressions.jsonl` written
- [x] #4 The in-run coordinator is DELETED (not parked): `src/absorb/{absorb_verdict,coordinator_*}.ts` + tests, `src/write_boundary.test.ts`, `.claude/agents/triage-coordinator.md`, and the `coordinator_log.jsonl`/`novel_issues.json`/`classifier_regressions.jsonl` path helpers are removed; no `Task(triage-coordinator)` grant remains
- [x] #5 `NovelIssue`/`NovelIssueCitation`/`MemberEvidence` types are relocated out of the deleted `novel_issues.ts` (locally in P1; to `@ariadnejs/skill-protocol` in P2); the build is clean with no dangling imports
- [x] #6 The `novel_issues_snapshot` is removed from the dispense payload, `get_entry_context.ts`, and `templates/prompt.md`; the investigator early-exits only on registry matches
- [x] #7 `assert_citations_consistent` removed and replaced by a unit test asserting every published FP row has a backing verdict
- [x] #8 End-to-end run on a real cloned repo publishes `triage_results/<run-id>.json` with `schema_version` `5`, a `tp` in `confirmed_unreachable[]`, and a non-empty `novel_issues[]` whose rows include `member_evidence` + `proposed_root_cause` + the deterministic `diagnosis`/`resolution_failure` signal; no `novel_issues.json`/`classifier_regressions.jsonl`/`coordinator_log.jsonl` is written under the run dir
- [x] #9 Colocated tests updated; removed-module tests deleted; `pnpm test`/skill `vitest` green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

The `triage` skill detects entry points (functions Ariadne found no resolved callers for), dispatches a per-entry investigator that returns one verdict per entry to `results/<entry_index>.json` — `tp` when the entry really is unreachable, `fp-*` when Ariadne's resolver missed a caller — and finalizes those verdicts into a published `triage_results/<run-id>.json`. The intended sink for false-positive signal — the in-run coordinator under `src/absorb/` — was built but never wired into any script: nothing ever wrote `novel_issues.json` or `classifier_regressions.jsonl`, so finalize read them and always published empty FP slices. On top of that, the deterministic "which part of Ariadne is at fault" signal the core already computes per entry (`EntryPointDiagnostics.diagnosis` + per-call-site `resolution_failure`/`receiver_kind`) was dropped at finalize. The result: triage cannot publish usable false-positive signal, which the downstream `plan` skill needs to group on.

This work makes the verdict files in `results/` the single source of truth and deletes the dead coordinator outright (offline grouping in `plan` subsumes it — no parking). The two FP-novel verdict kinds collapse into one self-contained `fp-novel` (the `*-cited` variant only existed to cite the coordinator's in-run snapshot), and every FP verdict now carries its own `member_evidence`, `proposed_root_cause`, and `evidence_excerpt` so each row stands alone for offline grouping. `build_finalization_output` builds `novel_issues[]` one-per-`fp-novel`-verdict (no merge) and derives `classifier_regressions[]` per-rule from the `fp-classifier-regression` verdicts in the same map — both slices now come from `verdicts_by_entry_index` alone. At finalize each published FP row is enriched with the deterministic core fault diagnostics (`diagnosis`, `resolution_failure {stage,reason}`, `receiver_kind`), attached from the entry's `EntryPointDiagnostics` (imported from `@ariadnejs/types`, not investigator-authored). The schema version bumps 4 → 5.

The whole in-run coordinator surface is removed: `src/absorb/{absorb_verdict,coordinator_*,novel_issues}.ts` + tests, `src/write_boundary.test.ts`, the `triage-coordinator` agent, the `novel_issues_snapshot` in the dispense payload/prompt, the investigator's `fp-novel-cited` early-exit, and the `novel_issues.json`/`coordinator_log.jsonl`/`classifier_regressions.jsonl` path helpers. Investigators now early-exit only on registry matches. The surviving published `NovelIssue` type (reshaped to the self-contained row) relocates next to `triage_verdict.ts`; `assert_citations_consistent` is replaced by a test asserting every published FP row has a backing verdict. In `@ariadnejs/skill-fs`, the now-dead `classifier_regressions.jsonl` reader/appender/record are deleted and `aggregate_classifier_regressions` is re-typed to the minimal `{rule_id, entry_index, evidence_excerpt}` input the finalize derivation feeds it.

Running the pipeline end-to-end for the first time surfaced a latent golden-path defect: `build_triage_entries` wrote a bare `group_id` into `known_source` for registry-auto-classified entries, but finalize's `parse_known_source` expects the `registry:<group_id>` form — so `detect → prepare → finalize` never completed against a real repo. The producer now writes the prefixed form, matching its sole consumer.

**Navigate from:** `src/finalize/output.ts` (`build_finalization_output`) is the front door — it owns both derived slices and the diagnostics enrichment (`attach_fault_diagnostics`). `src/verdict/triage_verdict.ts` owns the unified verdict union and the published `NovelIssue` row type. `scripts/finalize_triage.ts` is the orchestrator that now loads only `verdicts_by_entry_index`.

**Watch:**

- The deterministic `diagnosis` is always attached; `resolution_failure`/`receiver_kind` are attached only when the entry has a call ref with a non-null `resolution_failure` (and `receiver_kind` only for method call sites). Express's entry points are all `no-textual-callers`/`callers-not-in-registry`, so the end-to-end run exercises the `diagnosis`-only path; the failure-carrying path is covered by unit tests.
- The downstream `triage-curator` skill still parses the v4 shape (`schema_version === 4`, `flagged_novel_verdicts`, `NovelIssue` with `canonical_name`/`citations`). It therefore cannot consume v5 output until it is re-scoped to `plan` (Phase 3/4). This interim incompatibility is deliberate — the curator is being replaced, not patched — and the golden path under test is `detect → triage → publish`, not the curator round-trip.
- The `AriadneFaultArea` derivation that consumes the deterministic signal is authored later in TASK-190.22.3, not here.
- `novel_issues[].id` is `novel-<entry_index>` — stable and unique within a run, but positional across runs, so `diff_runs` cross-run novel-issue add/remove is approximate. The golden path and the `plan` skill group on the deterministic fault signal, not this id.
<!-- SECTION:NOTES:END -->
