---
id: TASK-190.19.5
title: Collapse Phase 4 and re-target `finalize_triage` to `novel_issues.json`
status: To Do
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

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All files listed under "Delete" are removed from the repository; `git grep` finds no references to `rough-aggregator`, `group-investigator`, `aggregation/slices`, `aggregation/pass1`, `aggregation/pass2`
- [ ] #2 `finalize_triage.ts` reads `novel_issues.json` directly; produces v4 `triage_results/<run-id>.json` with `novel_issues`, `classifier_regressions`, `confirmed_unreachable`, `uncertain` top-level sections
- [ ] #3 Schema version bumps 3 → 4; old `groups` / `residual-fp` / `residual-ungrouped` fields removed entirely (no shim)
- [ ] #4 `SKILL.md` describes the new Phase 3 flow; the Phase 4 aggregation section is gone
- [ ] #5 Fixture test asserts the full v4 `triage_results` payload with `toEqual` against a typed literal
<!-- AC:END -->
