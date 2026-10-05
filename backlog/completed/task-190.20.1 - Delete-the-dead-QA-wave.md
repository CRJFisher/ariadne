---
id: TASK-190.20.1
title: Delete the dead QA wave (script, agent, types, drift source)
status: Done
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - simplification
  - dead-code
dependencies: []
parent_task_id: TASK-190.20
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The QA wave's producer chain (`get_qa_context.ts` → `triage-curator-qa`
sub-agent → `qa/<group_id>.json`) exists, but no caller ever loads the
files. `finalize_run.ts:311` always invokes
`apply_proposals([], inv, …)` and hard-codes `qa_groups_checked: 0`,
`qa_outliers_found: 0` at lines 390–391. The on-demand "Maintenance flow"
the README documents is operator-pointed at the script directly; the
artefacts it writes have no consumer.

Post-190.19.4 the sole drift writer in practice is
`absorb_classifier_regressions`, fed by the in-flight
`classifier_regressions[]` slice published by `triage-entrypoints`. The
QA-sample drift path is structurally redundant.

This sub-task removes the entire chain — script, agent, intermediate
types, dead `apply_proposals` parameter, dead `CurationOutcome` fields,
the `qa-sample` `DriftEvidenceSource` variant in `@ariadnejs/types`, and
the meta.json / README references — in one pass.

## Scope

Delete (or downgrade to nothing):

- `.claude/skills/triage-curator/scripts/get_qa_context.ts`
- `.claude/skills/triage-curator/scripts/triage_curator_qa_prompt.test.ts`
- `.claude/agents/triage-curator-qa.md`
- `.claude/skills/triage-curator/src/source_excerpt.ts` (only consumer is
  the deleted QA script)
- `mark_drift_in_registry` + helpers in
  `.claude/skills/triage-curator/src/apply_proposals.ts:58–90`
- `QaOutlier` and `QaResponse` interfaces in
  `.claude/skills/triage-curator/src/types.ts:213–222`
- `qa: QaResponse[]` parameter on `apply_proposals` (`apply_proposals.ts`
  L258, L272) and all matching call sites
- `CurationOutcome.qa_groups_checked` / `qa_outliers_found` fields in
  `src/types.ts:163–164` plus their literal-zero writers in
  `scripts/finalize_run.ts:390–391`
- `DRIFT_OUTLIER_RATE_THRESHOLD` constant in `apply_proposals.ts:41`
- `PromotionCandidate.drift_qa_sample_count` field
- `count_drift_evidence_by_source`'s `qa-sample` branch in
  `src/promotion_candidates.ts`
- `drift_qa` column in `scripts/find_promotion_candidates.ts`
- `qa-classified-groups` flow + `triage-curator-qa` sub-agent entries in
  `.claude/skills/triage-curator/meta.json`
- README maintenance-flow section (`triage-curator/README.md` L192–247) +
  the `triage-curator-qa.md` sub-agent mention (~L283)
- SKILL.md QA-sample references (L392 + L444–448) + the
  `runs/<id>/qa/` working-dir reference (~L423)
- All `describe("mark_drift_in_registry")` test blocks +
  `const qa: QaResponse[]` literals in
  `src/apply_proposals.test.ts` (L99–253 and L357 onwards)

Collapse the `DriftEvidenceSource` discriminated union in
`packages/types/src/known_issues.ts` to a single-source representation
(either drop the union entirely or keep `source: "in-flight"` as the only
remaining variant for the wip-row contract).

## Acceptance criteria

<!-- AC:BEGIN -->

- [x] #1 None of the files listed in the "Scope — Delete" subsection
      remain in the repo
- [x] #2 `pnpm test` is green in `.claude/skills/triage-curator/` and
      `.claude/skills/triage-entrypoints/`
- [x] #3 `grep -rn "QaResponse\|QaOutlier\|mark_drift_in_registry\|qa-sample\|get_qa_context\|triage-curator-qa\|source_excerpt"` returns no hits inside
      `.claude/skills/triage-curator/` (matches in commit messages /
      changelogs / `backlog/` allowed)
- [x] #4 `finalize_run.ts` no longer hard-codes `qa_groups_checked` /
      `qa_outliers_found` literals — those fields are gone from the summary
      altogether
- [x] #5 `apply_proposals` signature has one parameter dropped (`qa:
QaResponse[]`); all callers updated
- [x] #6 README + SKILL.md no longer describe the QA wave; meta.json
      flow list is reduced accordingly

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

This is pure subtraction. No new tests, no new logic. The only
non-trivial bit is the `DriftEvidenceSource` union collapse in
`packages/types/` — that crosses a package boundary, so coordinate with
any in-flight consumers there.

### Resolution (2026-05-25)

Landed as part of Wave A. Deletions performed:

- `.claude/skills/triage-curator/scripts/get_qa_context.ts`
- `.claude/skills/triage-curator/scripts/triage_curator_qa_prompt.test.ts`
- `.claude/skills/triage-curator/src/source_excerpt.ts`
- `.claude/agents/triage-curator-qa.md`
- `mark_drift_in_registry` + `DRIFT_OUTLIER_RATE_THRESHOLD` in `apply_proposals.ts`
- `QaResponse` / `QaOutlier` types
- `qa: QaResponse[]` parameter on `apply_proposals` and all call sites
- `CurationOutcome.qa_groups_checked` / `qa_outliers_found` fields (and the
  literal-zero writers in `finalize_run.ts`)
- `PromotionCandidate.drift_qa_sample_count` field + `drift_qa` column in
  `find_promotion_candidates.ts`
- `count_drift_evidence_by_source` (replaced with flat `count_drift_evidence`)
- QA-wave entries in `meta.json` (`qa-classified-groups` flow + `triage-curator-qa`
  sub-agent)
- QA-wave prose in `README.md` and `SKILL.md`
- `DriftEvidenceSource` union in `packages/types/src/known_issues.ts` —
  collapsed to single-source; `DriftEvidence` is now `{ entry_index,
  evidence_excerpt }`. `append_drift_evidence` signature simplified to drop the
  `source` parameter. Dedupe key narrowed from `(entry_index, source)` to
  `entry_index` alone (assumption now load-bearing — documented inline in
  `drift_evidence.ts`).

Cross-skill verification (post-landing review): no consumer in
`packages/core/`, `packages/mcp/`, or `.claude/skills/triage-entrypoints/`
references the removed types. The on-disk registry carries no legacy
`source: "qa-sample"` rows, so the schema collapse is a clean round-trip.
