---
id: TASK-190.31.2
title: "Eval-set-driven automatic lifecycle transitions"
status: To Do
assignee: []
created_date: "2026-07-03 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - eval-sets
  - self-healing
parent_task_id: TASK-190.31
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

**Gated on TASK-190.31.1 evidence.** Do not start this task until the eval-sets
have accumulated across enough triage runs that the continuous-validation
metrics have a track record — concretely, until the per-run reports have
correctly identified promotion/regression/retirement candidates that a human
confirmed, over N consecutive runs. The threshold N is itself part of the
regime decision below.

With trustworthy eval-sets, give each classifier a local feedback loop (an
"eddy" off the main pipeline flow) and let the eval-set — not a human — decide
lifecycle transitions:

- **Automatic refinement.** When a classifier regresses on its own eval-set
  (recall drop: labeled group members it no longer matches; precision drop:
  matches later adjudicated `tp`), regenerate/tune the `BuiltinCheckFn`
  against the full eval-set and re-validate, gated on the eval-set metrics.
- **Automatic promotion.** `wip → permanent` fires when a classifier holds
  target precision/recall across N consecutive runs of its eval-set.
- **Automatic retirement.** Retirement (row deletion plus its `check_*.ts`,
  per TASK-190.35) fires when the eval-set shows the underlying pattern no
  longer occurs.
- **Threshold/safety-policy surface.** The one place a human still configures
  the loop: target metrics, N, and any category of transition reserved for
  human review.

### The regime decision

This deliberately relaxes the "human owns every registry decision" invariant
that TASK-190.30.x established — and that two mechanisms now enforce: the
TASK-190.33 in-repo write-guard hook (per-edit human `ask` on every
`registry.json` write) and the harness self-modification classifier. Those
guards exist precisely to stop unattended pipeline writes to the loop-closure
surface, which is what this task builds. Shipping it therefore requires an
explicit decision about the enforcement surface — a sanctioned automated
write path that the guards recognize, not a bypass — made when this task
starts, with the guards' rationale in view.

The `atomic_update_registry` write-boundary contract is retained regardless:
what changes is the decider for each transition, never the write mechanics.
`.claude/rules/classifier-lifecycle.md`, the reconcile-registry skill, and the
TASK-190.33 hook are updated together so the documented regime, the
enforcement, and the behavior stay consistent.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] The gate is honored: work starts only after TASK-190.31.1's reports have
      a human-confirmed track record across N consecutive runs, and the
      decision to relax the human-owns-registry invariant is recorded
      explicitly (in this task's implementation notes).
- [ ] An automatic-refinement path regenerates/tunes a regressed classifier's
      `BuiltinCheckFn` against its eval-set and re-validates, with no human
      review.
- [ ] Promotion (`wip → permanent`) and retirement (row + `check_*.ts`
      deletion) fire from eval-set thresholds held across N consecutive runs,
      not from human review.
- [ ] A human-set threshold/safety-policy surface exists (the one place a
      human still configures the loop), and the loops run without
      per-transition human review.
- [ ] Every automated write goes through `atomic_update_registry`; the
      TASK-190.33 write-guard and the lifecycle doc are updated coherently
      with the new regime (sanctioned automated path, not a bypass).

<!-- AC:END -->
