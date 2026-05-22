---
id: TASK-190.19.4
title: Wire `fp-classifier-regression` flag into curator drift signal
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - self-repair-pipeline
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

- [ ] #1 Triage results schema includes a `classifier_regressions` section aggregated from per-entry `fp-classifier-regression` verdicts
- [ ] #2 Curator updates wip rows: sets `drift_detected: true` and appends to `drift_evidence` with `source: "in-flight"` for each flagged rule
- [ ] #3 The flagged wip row is routed into the existing promoted-investigation puller path (no new puller logic; reuse the QA-promote routing)
- [ ] #4 QA sample-rate drift detection is unchanged — both signals coexist in the same `drift_evidence` array, distinguished by `source`
- [ ] #5 Tests cover the aggregation (finalize_triage side) and absorb (curator side) with `toEqual` against typed literals
<!-- AC:END -->
