---
id: TASK-190.31.1
title: "Eval-set store and continuous classifier validation"
status: To Do
assignee: []
created_date: "2026-07-03 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - eval-sets
parent_task_id: TASK-190.31
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Build the ground-truth substrate for classifier lifecycle decisions: a
per-group **eval-set** that accumulates labeled examples from each triage run,
and a **continuous-validation pass** that scores every active classifier
against its eval-set after each run. The human review gates are unchanged —
this phase makes the existing reviews (promotion, regression/retirement,
drafts) informed by computed metrics instead of judgment-only.

### The eval-set

Each triage run produces per-entry `TriageVerdict`s (`tp`, `fp-novel`,
`fp-classifier-regression`, `uncertain`) with evidence, in per-entry verdict
files under `triage_state/<project>/runs/<run-id>/results/`. Persist these as
a labeled eval-set per classifier group: each example carries the entry's
stable member identity `(file_path, name, kind, start_line)` — never the
run-local positional `entry_index` — plus its diagnostics and the adjudicated
label. The eval-set grows every run: new verdicts append, re-observations of a
known member update its history, and a group's ground-truth coverage strictly
increases over time.

A label-source asymmetry needs a design decision: entries matched by an active
classifier are auto-classified in triage Phase 2 and never reach an
investigator, so an active classifier's _fires_ are unlabeled by default.
Recall failures are labeled (an investigator's `fp-classifier-regression`
verdict marks a group member the classifier missed), but precision failures (a
classifier firing on a genuine `tp`) need a label source — e.g. sampled
re-adjudication of auto-classified hits, or recording Phase-2 matches into the
eval-set as classifier-claimed (distinct from investigator-adjudicated)
examples. Choose and document the mechanism.

### Continuous validation

After each run, score every active classifier against its accumulated
eval-set:

- **Recall** — of the eval-set members adjudicated as false-positives in this
  classifier's group, what fraction does the current `BuiltinCheckFn` match?
- **Precision** — of the entries the classifier matches, what fraction are
  adjudicated false-positives (vs `tp`)?

Surface the results as a per-run report: regressions (a classifier whose
metrics dropped), promotion candidates (a `wip` classifier holding target
metrics across consecutive runs), and retirement candidates (a group whose
pattern stopped occurring). The report feeds the existing human gates — the
human still decides every transition, via `reconcile-registry`, behind the
TASK-190.33 write-guard. No registry write is added or automated here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A per-group eval-set store accumulates labeled examples from each triage
      run's `TriageVerdict`s, keyed by the stable member identity, and grows
      monotonically across runs.
- [ ] The precision label source for active classifiers (whose hits are
      auto-classified in Phase 2 and never investigated) is decided and
      implemented, not left implicit.
- [ ] A continuous-validation pass scores every active classifier (precision +
      recall) against its eval-set after each run.
- [ ] The pass emits a human-readable report naming regressions, promotion
      candidates, and retirement candidates, referenced from the review flows
      it informs (`reconcile-registry` promotion review, regression review).
- [ ] No lifecycle transition is automated: the registry write path, the human
      gates, and the TASK-190.33 write-guard are untouched.

<!-- AC:END -->

## Implementation Notes

### Investigator replay-pair partition (wire from TASK-190.36.5 item 4)

This store has a second consumer beyond the classifier eval-set. TASK-190.36.5
item 4 ("Snapshot investigator eval seeds before pruning") is **deferred onto
this task**: no eval-set store existed when 190.36.5 landed, so building it here
is a precondition. Design this store as **one physical store with two logical
partitions**:

1. **Classifier examples** — the per-group labeled examples this task's
   Description defines (recall/precision ground truth).
2. **Investigator replay pairs** — `(dispense_payload, expected_verdict,
   member_identity, group_id)` tuples, so an investigator verdict can be
   replayed deterministically against its exact original input.

The replay-pair partition is populated by a **pre-prune snapshot**:
`prune_runs.ts` deletes `triage_state/<project>/runs/<run-id>/` at keep-count 5,
discarding both the per-entry verdicts and their byte-identical dispense-payload
inputs (built by `dispense/dispense_payload.ts`) — the reproducible inputs decay
while the published labels live forever. Before `rm`, snapshot the tuples into
this store, **prioritizing `diff_runs` flips** (the highest-signal regression
cases: an entry whose verdict changed between runs). Build this as the
investigator partition of this store, not a competing mechanism. When it lands,
close TASK-190.36.5 item 4.
