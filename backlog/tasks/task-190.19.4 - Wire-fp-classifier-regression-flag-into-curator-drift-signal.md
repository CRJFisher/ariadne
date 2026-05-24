---
id: TASK-190.19.4
title: Wire `fp-classifier-regression` flag into curator drift signal
status: Done
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-entrypoints
  - srp-redesign
  - triage-curator-extension
dependencies:
  - TASK-190.19.3
parent_task_id: TASK-190.19
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The `fp-classifier-regression` verdict is the in-flight, single-entry version of the curator's QA sample-rate drift signal. Where the curator's QA loop catches drift statistically (lagging, requires N members across the sample), the investigator emits a sharp single-entry flag the moment it spots a rule that _should_ have fired. Wiring this through the curator gives the wip-row drift field a second, faster source.

## Scope

### Aggregate regression flags into the run

`finalize_triage.ts` (further updated in 190.19.5) collects every `fp-classifier-regression` verdict's `should_have_matched_rule_id` into a new top-level section of `triage_results/<run-id>.json`:

```
classifier_regressions: Array<{
  rule_id: string;
  flagged_entries: Array<{ entry_index: number, evidence_excerpt: string }>;
}>
```

### Curator absorb

`.claude/skills/triage-curator/src/curate_all.ts` (or its successor) reads `classifier_regressions` from the run's triage results and, for each flagged `rule_id`:

- Looks up the corresponding wip row in `registry.json`.
- Updates `drift_detected: true` and appends to a new array field `drift_evidence: Array<{ entry_index, evidence_excerpt, source: "in-flight" | "qa-sample" }>` (extending the existing drift schema; `source` distinguishes the two signals).
- Routes the rule into the curator's promoted-investigation puller (just as the QA sample-rate path does today).

### Tests

- `finalize_triage.test.ts` — given a triage state with two regression verdicts, assert the `classifier_regressions` aggregate is produced with `toEqual` on a typed literal.
- `curator_drift_absorb.test.ts` — given a triage results fixture with one regression flag against an existing wip row, assert the registry update (`drift_detected: true` + `drift_evidence` entry with `source: "in-flight"`).

## Out of scope

- Removal of QA sample-rate drift detection — kept as a complementary lagging signal.
- Investigator prompt changes (already in 190.19.3).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Triage results schema includes a `classifier_regressions` section aggregated from per-entry `fp-classifier-regression` verdicts
- [x] #2 Curator updates wip rows: sets `drift_detected: true` and appends to `drift_evidence` with `source: "in-flight"` for each flagged rule
- [x] #3 The flagged wip row is routed into the existing promoted-investigation puller path (no new puller logic; reuse the QA-promote routing)
- [x] #4 QA sample-rate drift detection is unchanged — both signals coexist in the same `drift_evidence` array, distinguished by `source`
- [x] #5 Tests cover the aggregation (finalize_triage side) and absorb (curator side) with `toEqual` against typed literals
<!-- AC:END -->

## Implementation Notes

### Per-run regression log (SRP)

`fp-classifier-regression` verdicts are persisted by the dispatcher to a per-run append-only JSONL at `<run-dir>/classifier_regressions.jsonl` (constant `CLASSIFIER_REGRESSIONS_FILENAME` in `triage_state_paths.ts`). Append happens under the existing `with_path_lock` mutex in `absorb_verdict.ts`. Records carry `timestamp`, `entry_index`, `should_have_matched_rule_id`, `evidence_excerpt`, and `member_evidence` — the full verdict payload plus the dispatcher clock.

`finalize_triage.ts` reads the JSONL via `read_classifier_regression_records` and passes the result through `aggregate_classifier_regressions` (groups by `rule_id`, dedupes `(rule_id, entry_index)`, preserves first-seen order at both levels) into `build_finalization_output`'s context. The `classifier_regressions` array lands in `triage_results/<run-id>.json` as a top-level field on `FinalizationOutput`.

### Drift-evidence schema (shared)

`KnownIssue.drift_evidence?: DriftEvidence[]` was added in `packages/types/src/known_issues.ts`. Each row carries `entry_index`, `evidence_excerpt`, and `source: "qa-sample" | "in-flight"`. Both drift writers share the field; the discriminator preserves provenance. The curator-side `ClassifierRegressionFlag` type was lifted into `@ariadnejs/types` so SRP and the curator reference one canonical shape — no local mirrors.

### Shared drift-evidence helper

The two drift writers — QA-sample (`mark_drift_in_registry`) and in-flight (`absorb_classifier_regressions`) — share `append_drift_evidence(issue, candidates, source)` in `.claude/skills/triage-curator/src/drift_evidence.ts`. The helper dedupes on `(entry_index, source)`, flips `drift_detected: true` when any row is added, and returns `{ issue, changed }` so both callers can short-circuit no-ops cleanly.

### Curator absorb wiring

`apply_proposals` accepts `classifier_regressions: ClassifierRegressionFlag[]` (required) and runs the in-flight absorb before the QA-sample drift pass. Both signals' newly-tagged rule ids merge into the unified `drift_tagged_groups` list; permanent-row regressions merge into `skipped_permanent_upserts`. No new `in_flight_*` fields on `ApplyResult` — collapsed per YAGNI since no consumer needs to attribute drift to a specific source (the per-row `drift_evidence.source` already does).

### Routing into the puller

AC #3 is satisfied by the existing `sort_by_drift_priority` in `.claude/skills/triage-curator/scripts/next_investigate_tasks.ts`: any wip row with `drift_detected === true` sorts to the front of the investigate dispatch list, regardless of which signal raised the flag. No new puller logic.

### Lifecycle doc

`.claude/rules/classifier-lifecycle.md` was updated to list `drift_evidence` in the curator writer row and to document the two-source contract (qa-sample + in-flight) in the prose below the writer table.

### Tests

- `classifier_regressions.test.ts` (SRP) — append/read/parse + aggregation with `toEqual` typed literals.
- `build_finalization_output.test.ts` — new test asserts `classifier_regressions` lands verbatim in the published output.
- `absorb_verdict.test.ts` — extended with regression-absorb cases (record append + isolation from novel-verdict path).
- `curator_drift_absorb.test.ts` — `absorb_classifier_regressions` unit tests (drift tag, qa-coexistence, idempotency, permanent skip, unknown skip, duplicate-rule merge, empty-flagged no-op).
- `apply_proposals.test.ts` — new "classifier_regressions integration" describe block with end-to-end coverage: in-flight tag, qa+in-flight coexistence on the same group, permanent-row routing into `skipped_permanent_upserts`, empty no-op.
