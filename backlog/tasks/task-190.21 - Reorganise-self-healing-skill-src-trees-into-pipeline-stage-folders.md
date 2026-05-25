---
id: TASK-190.21
title: >-
  Reorganise self-healing skill src trees into pipeline-stage folders; hoist
  shared helpers into a workspace package
status: To Do
assignee: []
created_date: "2026-05-24 16:00"
labels:
  - self-repair
  - triage-entrypoints
  - triage-curator
  - information-architecture
  - refactor
dependencies:
  - TASK-190.19
  - TASK-190.20.1
  - TASK-190.20.2
parent_task_id: TASK-190
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The 190.19 redesign collapsed the Phase 4 aggregation cascade and added the
coordinator absorb path. The behaviour shape now reads cleanly, but the
**module layout has not caught up**: `triage-entrypoints/src/` is ~50 files
flat with one sub-folder (`coordinator/`); `triage-curator/src/` is ~25
files flat with no sub-folders. CLAUDE.md says folder + file names should
be expressive of the action they instantiate from the project's intention
tree. Today a reader cannot see the per-entry-investigator →
coordinator → novel-issues → finalize pipeline from the file layout — it
reads as an undifferentiated bag with one nested grouping that splits a
single absorb stage across two depths.

Two related leftovers compound the cost:

- `atomic_write.ts` is duplicated **byte-for-byte** across the two skills
  with a "keep in sync" comment — exactly the kind of transitional layer
  the constitution forbids.
- `guard_tsx_invocation.ts` (entrypoints) and `require_node_import_tsx.ts`
  (curator) are the same 12-line side-effect module under two names.

## Architecture

### `triage-entrypoints/src/` — stage sub-folders

Reorganise the flat surface into folders that name pipeline stages:

```text
triage-entrypoints/src/
  dispense/
    dispense_payload.ts
    language_from_extension.ts
  verdict/
    triage_verdict.ts
    strict_parse.ts
  absorb/                 ← renamed from coordinator/
    absorb_verdict.ts     ← pulled in from top level
    novel_issues.ts       ← pulled in from top level
    classifier_regressions.ts  ← pulled in from top level
    coordinator_decision.ts    ← was coordinator/decision.ts
    coordinator_apply_decision.ts  ← was coordinator/apply_decision.ts
    coordinator_log.ts    ← was coordinator/log.ts
    coordinator_prompt.ts ← was coordinator/prompt.ts
  finalize/
    output.ts             ← was build_finalization_output.ts (pure builder)
    verdict_ledger.ts     ← extracted I/O loader (shared by merge_results + finalize)
    merge_results.ts
    confirmed_unreachable_reuse.ts
  store/
    paths.ts              ← merged paths.ts + triage_state_paths.ts
    latest_pointer.ts     ← LATEST-pointer I/O split off
    triage_results_store.ts
    analysis_output.ts
    run_discovery.ts
  cross_run/
    diff_runs.ts
  (top level: known_issues_registry.ts, prepare_triage.ts, project_id.ts,
   progress.ts, cli_args.ts — these stay flat; they cut across stages.)
```

The `absorb/` rename + consolidation is the highest-leverage move: today
the dispatcher entry (`absorb_verdict.ts`) and the file it writes
(`novel_issues.ts`) live at the top level while `coordinator/` nests their
helpers. One cohesive stage, one folder.

### `triage-curator/src/` — stage sub-folders

```text
triage-curator/src/
  absorb/
    drift_absorb.ts       ← renamed from curator_drift_absorb.ts (folder already names the actor)
    drift_evidence.ts
    observation_counts.ts
    classifier_regression_chain.test.ts
  propose/
    promotion_candidates.ts
    propose_backlog_tasks.ts
    validate_investigate_responses.ts
    render_ariadne_bug_body.ts   ← folded in: only consumer is propose-stage apply_proposals
    impact_report.ts             ← folded in: standalone reporter, same authoring stage
  apply/
    apply_proposals.ts
    orphan_cleanup.ts
  store/
    paths.ts
    scan_runs.ts
    curation_outcome.ts
    session_log.ts
    parse_triage_results.ts
  (top level: types.ts — cross-stage.)
```

Drop the `curator_` prefix from `curator_drift_absorb.ts` — the folder
already names the actor.

Note on `render/`: after **190.20.1** deletes `source_excerpt.ts` (QA-only)
and **190.20.2** collapses `render_classifier.ts` into the investigator
loop or finalize, the proposed `render/` folder collapses to 1–2 files
(`render_ariadne_bug_body.ts`, `impact_report.ts`). A one-or-two-file
folder fails the IA test of "folder names a stage". Both surviving
modules belong to the propose stage — they author content the curator
will commit (bug-report bodies, impact summaries) — so they fold into
`propose/` and the `render/` folder is dropped.

### Shared workspace package: `@ariadnejs/skill-fs`

Hoist three modules currently duplicated or near-duplicated across the two
skills into a new sibling package alongside `@ariadnejs/types`:

- `atomic_write.ts` — POSIX temp+rename helper (byte-identical today)
- `require_node_import_tsx.ts` — tsx side-effect guard (same 12 lines
  under two names today)
- `errors.ts` — the curator's `error_code(err)` helper, useful for any fs
  caller

Both skills already depend on `@ariadnejs/types`; a sibling
`@ariadnejs/skill-fs` is the natural home.

### Test colocation + agent-prompt contract tests

Move agent-prompt pin tests out of `src/`:

- `triage-curator/src/triage_curator_investigator_prompt.test.ts` →
  `triage-curator/tests/agent_prompt_pin.test.ts`
- `triage-curator/scripts/triage_curator_qa_prompt.test.ts` →
  `triage-curator/tests/agent_qa_prompt_pin.test.ts`

These tests have no source partner — they pin agent doc frontmatter +
body shape, which is contract-level, not unit-level. `src/` is the wrong
home.

### Pure / I/O split inside `build_finalization_output.ts`

`build_finalization_output.ts` currently owns both the published-output
type/builder AND `load_verdicts_by_entry_index` (the I/O loader). Split
into `finalize/output.ts` (pure builder + summary) and
`finalize/verdict_ledger.ts` (the I/O loader). Route both
`merge_results.ts` and `finalize/output.ts` through the shared loader so
the absorb-time and finalize-time gates cannot diverge again (the recent
`VERDICT_FILE_BASENAME` divergence fix is then structural, not just
discipline).

## High-level flow

This task does not change behaviour — every test that passes today must
pass byte-for-byte after the reshuffle. The win is information
architecture: a reader landing in either `src/` should be able to read
the pipeline off the folder listing.

## What survives

- All public exports from both skills' source files. Scripts under
  `scripts/` re-target their imports to the new paths.
- `@ariadnejs/types` and the existing `@ariadnejs/core`/`@ariadnejs/mcp`
  packages are untouched.
- Test colocation rule (`foo.ts` next to `foo.test.ts`) is preserved by
  moving tests with their source.

## What collapses

- `triage-entrypoints/src/atomic_write.ts` (moved to package).
- `triage-curator/src/atomic_write.ts` (moved to package).
- `triage-entrypoints/src/guard_tsx_invocation.ts` (moved + renamed).
- `triage-curator/src/require_node_import_tsx.ts` (moved + renamed).
- `triage-curator/src/errors.ts` (moved to package).
- The flat top-level layout of both skills' `src/`.
- The `coordinator/` sub-folder (renamed to `absorb/` with absorb-stage
  siblings pulled in).
- The `paths.ts` / `triage_state_paths.ts` split (merged + LATEST-pointer
  I/O split off).

## Sub-tasks

Phase A — shared package (lands first, unblocks the duplications):

- **190.21.1** — Create `@ariadnejs/skill-fs` package; move
  `atomic_write.ts`, `require_node_import_tsx.ts`, `errors.ts`; switch
  both skills' imports.

Phase B — triage-entrypoints reorganisation (independent units, can land
in any order once A is in):

- **190.21.2** — Split `build_finalization_output.ts` into
  `finalize/output.ts` (pure) + `finalize/verdict_ledger.ts` (I/O);
  route `merge_results.ts` through the loader.
- **190.21.3** — Merge `paths.ts` + `triage_state_paths.ts` into
  `store/paths.ts`; split LATEST-pointer I/O into
  `store/latest_pointer.ts`.
- **190.21.4** — Rename `coordinator/` → `absorb/`; pull
  `absorb_verdict.ts`, `novel_issues.ts`, `classifier_regressions.ts`
  inside; flatten the `coordinator_` prefix off the four nested files.
- **190.21.5** — Move remaining files into `dispense/`, `verdict/`,
  `finalize/` (the non-absorb parts), `store/`, `cross_run/`.

Phase C — triage-curator reorganisation:

- **190.21.6** — Move files into `absorb/`, `propose/`, `apply/`,
  `store/`; rename `curator_drift_absorb.ts` → `drift_absorb.ts`.
  Folds `render_ariadne_bug_body.ts` + `impact_report.ts` into
  `propose/` (no separate `render/` folder). Depends on 190.20.1
  (deletes `source_excerpt.ts`) and 190.20.2 (collapses
  `render_classifier.ts`) landing first.

Phase D — test relocation:

- **190.21.7** — Move agent-prompt pin tests out of `src/` into a sibling
  `tests/` directory.

## Constraints

- **Behaviour-preserving.** Every test, both skills' `tsc --noEmit`, and
  the cross-skill scripts (`finalize_run.ts`, `next_investigate_tasks.ts`)
  must work byte-for-byte after each sub-task. Use `git mv` so history
  follows the moves.
- **No backwards-compat shims.** No barrel re-exports from old paths, no
  deprecated path aliases. Update every importer in the same commit per
  the constitution.
- **One sub-task per commit.** Each sub-task is a small, mechanical move
  with all importers updated in lockstep. Reviewers should see the move
  + its caller updates together.
- **Write-boundary contract preserved.** The shared `@ariadnejs/skill-fs`
  package does not weaken the
  `.claude/rules/classifier-lifecycle.md` contract — the curator stays
  the sole autonomous writer of `registry.json`, and triage-entrypoints
  stays read-only against it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `@ariadnejs/skill-fs` package exists at `packages/skill-fs/`; both skills import `atomic_write_file`, `require_node_import_tsx`, and `error_code` from it; no duplicate copies remain under either `src/`
- [ ] #2 `triage-entrypoints/src/` has top-level folders `dispense/`, `verdict/`, `absorb/`, `finalize/`, `store/`, `cross_run/`; the `coordinator/` folder no longer exists
- [ ] #3 `triage-curator/src/` has top-level folders `absorb/`, `propose/`, `apply/`, `store/` (no `render/`; `render_ariadne_bug_body.ts` + `impact_report.ts` live in `propose/`)
- [ ] #4 `build_finalization_output.ts` is split into `finalize/output.ts` + `finalize/verdict_ledger.ts`; `merge_results.ts` and `finalize/output.ts` both consume the shared loader (no duplicate `results/` walk)
- [ ] #5 `paths.ts` and `triage_state_paths.ts` are merged into `store/paths.ts`; LATEST-pointer I/O lives in `store/latest_pointer.ts`
- [ ] #6 `curator_drift_absorb.ts` is renamed to `drift_absorb.ts` (folder names the actor); no `curator_*` prefix survives under `triage-curator/src/`
- [ ] #7 Agent-prompt pin tests (`triage_curator_investigator_prompt.test.ts`, `triage_curator_qa_prompt.test.ts`) live under `triage-curator/tests/`, not `src/`
- [ ] #8 All 612 existing tests still pass; both skills' `tsc --noEmit` is clean; cross-skill scripts (`finalize_run.ts`, `next_investigate_tasks.ts`, `find_promotion_candidates.ts`) run end-to-end against a fixture
- [ ] #9 Every file move uses `git mv`; commit history preserves the rename trail
- [ ] #10 No barrel re-exports from old paths; no deprecated aliases; importers updated in lockstep with each move

<!-- AC:END -->
