---
id: TASK-190.31
title: "Growable classifier eval-sets for human-free self-healing eddy loops"
status: To Do
assignee: []
created_date: "2026-07-01 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - self-healing
  - eval-sets
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Today every classifier lifecycle transition is a human decision: the human
reviews a `classifier-author` draft before `--stage --apply`, reviews promotion
candidates before `wip → permanent`, and reviews drift evidence before flipping
`drift_detected`. This keeps the human in the loop on the classifier catalog. The
cost is one human review per transition; the ceiling is that classifiers cannot
improve faster than a human can review them.

This task closes that loop: build **growable classifier eval-sets** that
accumulate ground truth after each triage run, and drive the classifier
lifecycle from those eval-sets automatically — **removing the human from
classifier review in all cases**.

### The eval-set

Each triage run already produces per-entry `TriageVerdict`s (`tp`, `fp-novel`,
`fp-classifier-regression`, `uncertain`) with evidence. Persist these as a
**labeled eval-set per classifier group**: each verdict is a labeled example
(the entry's stable `(file_path, name, kind, start_line)` identity + its
diagnostics + the adjudicated label). The eval-set **grows** every run — new
verdicts append, so a classifier's ground-truth coverage strictly increases over
time.

### Self-healing eddy loops

With an eval-set per group, each classifier gains a local feedback loop (an
"eddy" off the main pipeline flow):

- **Continuous validation.** After each run, evaluate every active classifier
  against its accumulated eval-set: precision (does it fire only on true
  false-positives?) and recall (does it catch every labeled member of its
  group?). A classifier that regresses on its own eval-set is the signal that
  today's human drift review provides — but computed, not adjudicated.
- **Automatic refinement.** When a classifier's eval-set contains members it no
  longer matches (recall drop) or matches that later adjudicated as `tp` (a
  precision drop), regenerate/tune the `BuiltinCheckFn` against the full
  eval-set and re-validate — with no human in the loop, gated on the eval-set
  metrics rather than a human's judgment.
- **Automatic promotion / retirement.** `wip → permanent` fires when a
  classifier holds target precision/recall across N consecutive runs of its
  eval-set; retirement fires when the eval-set shows the underlying pattern no
  longer occurs (the fix landed) — both driven by eval-set thresholds, not human
  review.

### Removing the human review gate

This supersedes the human-review requirements the current lifecycle encodes
(`.claude/rules/classifier-lifecycle.md`): the `--stage` human-apply gate, the
promotion-review gate, and the drift-absorb gate. In the target state the human
sets the eval-set thresholds and the safety policy once; the eddy loops apply
every transition automatically from eval-set evidence. The write-boundary /
atomic-write contract still holds (all writes through `atomic_update_registry`);
what changes is that the **decider** for each transition becomes the eval-set,
not a human.

This is a deliberate relaxation of the "human owns every registry decision"
invariant that TASK-190.30.x established, made safe by the eval-sets: a
transition is only as trustworthy as the ground truth backing it, and the
eval-set is that ground truth, growing monotonically with every run.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A per-group eval-set store accumulates labeled examples from each triage
      run's `TriageVerdict`s, keyed by the stable member identity, and grows
      monotonically across runs.
- [ ] A continuous-validation pass scores every active classifier against its
      eval-set (precision + recall) after each run and surfaces regressions.
- [ ] An automatic-refinement path regenerates/tunes a regressed classifier's
      `BuiltinCheckFn` against its eval-set and re-validates, with no human
      review.
- [ ] Promotion (`wip → permanent`) and retirement fire from eval-set thresholds
      held across N consecutive runs, not from human review.
- [ ] The lifecycle doc and skills are updated: eval-set-driven transitions
      replace the human `--stage` / promotion / drift-absorb review gates, while
      the `atomic_update_registry` write-boundary contract is retained.
- [ ] A human-set threshold/safety-policy surface exists (the one place a human
      still configures the loop), and the loops run without per-transition human
      review.

<!-- AC:END -->
