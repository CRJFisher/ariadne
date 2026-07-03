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

Every classifier lifecycle transition is a human decision: the human reviews a
`classifier-author` draft before `reconcile-registry --stage --apply`, reviews
promotion candidates before `wip → permanent`, and reviews regression evidence
before retiring a rule (retirement deletes the row and its `check_*.ts`;
TASK-190.35). The in-repo write-guard hook (TASK-190.33) makes that per-edit
human checkpoint mechanical. This keeps the human in the loop on the classifier
catalog; the ceiling is that classifiers cannot improve faster than a human can
review them.

This task raises that ceiling in two phases. Phase one builds the ground truth:
**growable classifier eval-sets** that accumulate labeled examples from each
triage run's `TriageVerdict`s, plus a continuous-validation pass that scores
every active classifier (precision + recall) against its eval-set after each
run. The human gates are unchanged — the eval-sets make the existing reviews
informed instead of judgment-only. Phase two, gated on phase one's evidence,
drives lifecycle transitions from eval-set thresholds automatically — removing
the per-transition human review.

The split is deliberate. A transition is only as trustworthy as the ground
truth backing it, and today that ground truth does not exist: the eval-sets
need multiple triage runs of accumulated verdicts before precision/recall
thresholds mean anything. Phase one accumulates and proves the metrics; phase
two spends them. Phase two is also a regime decision — it relaxes the
"human owns every registry decision" invariant that TASK-190.30.x established
and TASK-190.33 mechanically enforces — and that decision is made explicitly
when phase one's evidence supports it, not as a side effect of building the
plumbing.

### Sub-tasks

**TASK-190.31.1 — Eval-set store and continuous classifier validation** —
Persist per-group labeled eval-sets that grow monotonically across runs, keyed
by the stable member identity `(file_path, name, kind, start_line)`; score
every active classifier against its eval-set after each run; surface
regressions and promotion candidates as reports feeding the existing human
review gates. See sub-task for detail.

**TASK-190.31.2 — Eval-set-driven automatic lifecycle transitions** — Gated on
TASK-190.31.1 evidence held across N runs: automatic refinement of regressed
`BuiltinCheckFn`s, threshold-driven promotion and retirement, and a human-set
threshold/safety-policy surface replacing per-transition review. See sub-task
for detail.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] TASK-190.31.1 complete: eval-sets accumulate across runs and the
      continuous-validation pass scores every active classifier, with the human
      review gates unchanged.
- [ ] TASK-190.31.2 complete (or explicitly rejected as a regime decision):
      lifecycle transitions fire from eval-set thresholds without
      per-transition human review, with the `atomic_update_registry`
      write-boundary contract retained.

<!-- AC:END -->

## Sub-tasks

- TASK-190.31.1: Eval-set store and continuous classifier validation
- TASK-190.31.2: Eval-set-driven automatic lifecycle transitions
