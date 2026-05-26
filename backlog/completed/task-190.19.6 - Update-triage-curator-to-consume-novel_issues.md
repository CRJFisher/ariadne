---
id: TASK-190.19.6
title: Curator absorb path — consume v4 `triage_results` and route novel-issues + regressions
status: Done
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-curator
  - srp-redesign
dependencies:
  - TASK-190.19.5
parent_task_id: TASK-190.19
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The curator now reads pre-consolidated `novel_issues[]` + `classifier_regressions[]` directly from the v4 `triage_results/<run-id>.json` (190.19.5). This task wires the absorb path and the registry/puller routing — without touching the curator-investigator agent (covered in 190.19.7) or `find-promotion-candidates` / curator-QA (covered in 190.19.8).

## Scope

`.claude/skills/triage-curator/scripts/curate_all.ts` and the modules it orchestrates:

- Read the v4 `triage_results/<run-id>.json`; drop all reads of the legacy `groups` / `residual-fp` / `residual-ungrouped` fields (they no longer exist).
- For each `novel_issue` in the run:
  - If the issue's `id` is already in `registry.json` as a `wip` or `permanent` row → bump `observed_count`, append to `observed_projects`, update `last_seen_run`.
  - Otherwise → route into the existing investigation puller as a "promote-novel" task. The investigator dispatched here is the narrowed one from 190.19.7; this task only sets up the routing.
- For each `classifier_regression` flag → apply the wip-row drift update wired in 190.19.4 (this task just reads the flag list and dispatches; no new drift logic).

### Tests

- `curator_novel_issues_absorb.test.ts` — given a v4 triage_results fixture with three novel issues (one already wip in registry, two new) plus two regression flags, assert the registry update + puller routing with `toEqual` on typed literals.

## Out of scope

- Curator-investigator agent prompt rewrite (190.19.7).
- `find-promotion-candidates` + curator-QA verification (190.19.8).
- Skill rename (190.19.9).
- Docs / diagrams (190.19.10).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Curator reads v4 `triage_results/<run-id>.json`; consumes `novel_issues` + `classifier_regressions` sections; no reads of legacy `groups` / `residual-fp` fields remain in code
- [x] #2 Already-registered novel issues bump `observed_count` / `observed_projects` / `last_seen_run`; new ones route into the existing puller as "promote-novel" tasks
- [x] #3 Regression flag dispatch routes into the same drift-handling path established in 190.19.4 (no duplicate drift logic)
- [x] #4 Tests cover the absorb path with `toEqual` against typed literal registry + puller states
<!-- AC:END -->

## Implementation Notes

### v4 read surface

- `TriageResultsFile` (`src/types.ts`) rewritten to the v4 publish surface: `novel_issues[]`, `flagged_novel_verdicts[]`, `classifier_regressions[]`, `confirmed_unreachable[]` (with `ConfirmedUnreachableSource` discriminator), `uncertain[]`, plus `schema_version`, `project_path`, `commit_hash`, `last_updated`. Legacy `false_positive_groups`, `group_match_history`, and the v2 `FalsePositiveEntry[]`-shaped `confirmed_unreachable` are gone.
- `src/parse_triage_results.ts` is the single chokepoint: `parse_v4_triage_results` + `read_v4_triage_results`. Hard-rejects non-v4 `schema_version`, asserts the five required top-level arrays exist, surfaces a source-labeled error on malformed JSON. Wired into `curate_all`, `finalize_run`, `validate_responses`, and `get_investigate_context` — no `JSON.parse … as TriageResultsFile` reaches the body of those scripts.

### Absorb path (`curate_all` → puller → finalize)

- `scripts/curate_all.ts` reads v4 runs and emits per-run `RunDispatch`:
  - `novel_promote_dispatches[]` — full puller `DispatchEntry` shape (`run_path`, `group_id`, `output_path`, `get_context_cmd`). The main agent concatenates `runs[*].novel_promote_dispatches[]` directly into the dispatch list file; no field renaming.
  - `already_registered_novel_issues[]` — `{ novel_issue_id, registry_status: "wip" | "permanent", observed_increment }` for the run summary. The actual observed-stat bump happens in `finalize_run` → `apply_proposals` → `bump_observed_stats`.
  - `fixed_novel_issue_resurfacings[]` — `{ novel_issue_id, citation_count }` when a novel issue's id matches a `status: "fixed"` registry row. The fix-sequencer reconciler is the only authorized `fixed` writer (see `.claude/rules/classifier-lifecycle.md`); the curator surfaces resurfacings for human review rather than auto-bumping or re-dispatching.
  - `classifier_regressions[]` — `{ rule_id, flagged_entry_count }` mirror of the run's regression aggregate. Drift mutation flows through `apply_proposals.classifier_regressions` (wired in 190.19.4) — no separate dispatch.

- `src/observation_counts.ts` (`compute_observation_counts`) derives the per-registry-`group_id` count map from two sources: `novel_issues[]` citations (registered novel issues only contribute counts; new ones route to the puller) and `confirmed_unreachable[]` rows with `source.kind === "registry"`. Sums when the same id appears in both — defensive against a hypothetical SRP coordinator that double-publishes.

- `bump_observed_stats` (`src/apply_proposals.ts`) now skips `status: "fixed"` rows. Closes a regression where v4's `confirmed_unreachable` re-fires for a fixed rule would otherwise re-bump `observed_count` on every run, violating the reconciler's write-boundary.

### Puller simplification

- `scripts/next_investigate_tasks.ts` drops the QA-promotion fold (no more `compute_promotions`); the puller is now a dedupe-by-`output_path` + `sort_by_drift_priority` + filter-done pipeline. `sort_by_drift_priority` is unchanged — wip rows with `drift_detected === true` (set by either the in-flight or QA-sample path) still float to the front of the queue.

### Investigator context

- `scripts/get_investigate_context.ts` now hydrates a "promote-novel" context: full `NovelIssue` record + registry + signal inventory. Drops `--promoted` and `residual/promoted` mode toggle. The agent prompt itself (`.claude/agents/triage-curator-investigator.md`) is untouched per the 190.19.7 scope split.
- `scripts/validate_responses.ts` derives `source_entry_count` from `novel_issue.citations.length` for index-range validation.
- `src/validate_investigate_responses.ts` swaps `source_group: FalsePositiveGroup | null` for `source_entry_count: number | null`. Semantically equivalent; smaller surface, no v4 dependency leak into the pure validator.

### Render + apply

- `src/render_ariadne_bug_body.ts` replaces the file:line "Example entries" section with citation excerpts pulled from the dispatched novel issue (`## Example citations`). `apply_proposals.ts` plumbs `novel_issues_by_id` through.
- `derive_languages_for_upsert` no longer takes a source group — under v4 the published artifact carries no FP entry file paths to fall back on. Language gates must come from the classifier spec's `language_eq` check; missing-language new entries surface as `failed_authoring` rather than landing with an empty list.

### Deleted

- `scripts/promote_novel_groups.ts`, `src/promote_novel_groups.ts`, `src/promote_novel_groups.test.ts` — under v4 the SRP per-entry triage + coordinator already perform novel-issue consolidation. The curator's role narrows to absorb/promotion; no aggregation pass needed. SKILL.md "Promoting novel groups (on demand)" section removed.

### Out-of-scope readers

`scripts/get_qa_context.ts` and `scripts/find_promotion_candidates.ts` are punted to TASK-190.19.8 for full QA/v4 rework. Both are updated minimally here so they still compile + run against the v4 shape (QA samples `confirmed_unreachable[]` rows with `source.kind === "registry"`; promotion-candidate match history reconstructs from the same source). No new behavior; no curator-QA dispatch path is wired in this task — `curate_all` emits no QA dispatches.

### Tests (toEqual typed literals)

- `scripts/curator_novel_issues_absorb.test.ts` — three tests: classify partition (wip / permanent / fixed / new), empty no-op, regression absorb interaction. Uses `toEqual` with typed `NovelPromoteDispatch[]`, `AlreadyRegisteredNovelIssue[]`, `FixedNovelIssueResurfacing[]`, `KnownIssue[]`.
- `src/observation_counts.test.ts` — empty input, citation count, registry-hit count, novel/registry id collision (additive).
- `src/parse_triage_results.test.ts` — v4 happy path, schema-version mismatch, missing required array, non-array root, non-object root, invalid JSON.
- `src/apply_proposals.test.ts` — new test asserts `bump_observed_stats` skips `status: "fixed"` rows even when the row's `group_id` has a positive count.
- `src/render_ariadne_bug_body.test.ts` — full re-shape to `NovelIssue` source.
- `src/validate_investigate_responses.test.ts` — `source_entry_count: number | null` swap.

### Review fixes folded in

Five Opus reviewers (AC compliance, architecture, test coverage, code correctness, refactor / PR-level) raised the following — all addressed in-task:

- **HIGH** `classify_novel_issues` silently dispatched `status: "fixed"` rows for re-investigation. Now routed to a dedicated `fixed_novel_issue_resurfacings` list; `bump_observed_stats` skips them too.
- **HIGH** `validate_responses.ts` had no `schema_version` check; v3 input would have produced confusing `Cannot read properties of undefined`. Now routed through the shared `read_v4_triage_results` helper.
- **HIGH** `JSON.parse(...) as TriageResultsFile` cast across four scripts with no shape verification. Centralized in `parse_triage_results.ts`; required top-level arrays are now asserted before downstream `.find()` / `.map()` calls.
- **MEDIUM** `NovelPromoteDispatch` shape did not match the puller's `DispatchEntry` (had `novel_issue_id` instead of `group_id`, no `run_path`). Now the producer's output is puller-shaped; SKILL.md drops the manual rename step.
- **MEDIUM** Stale doc comments in `apply_proposals.ts` and `propose_backlog_tasks.ts` referenced deleted modules (`promote_to_investigate.ts`, `promote_novel_groups`). Updated.
- **LOW** README header now carries a "stale, pending 190.19.10" banner pointing to SKILL.md as authoritative.
