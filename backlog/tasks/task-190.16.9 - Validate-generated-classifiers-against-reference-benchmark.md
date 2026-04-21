---
id: TASK-190.16.9
title: Validate generated classifiers against reference benchmark cases
status: To Do
assignee: []
created_date: "2026-04-20 10:00"
labels:
  - self-repair
  - auto-classifier
  - validation
dependencies:
  - TASK-190.16.8
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - >-
    /Users/chuck/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/
  - .claude/skills/self-repair-pipeline/src/auto_classify/
  - .claude/skills/self-repair-pipeline/known_issues/registry.json
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Audit the set of classifiers produced by TASK-190.16.8 (curator-driven generation from webpack triage data) against the reference benchmark table documented in TASK-190.16.8's description. The reference table is the human-designed taxonomy of the 10 failure-mode groups we expected to see on the webpack corpus; this task asks whether the curator actually found them, where it diverged, and whether each divergence is justified by the data.

**Reference benchmark (copied from TASK-190.16.8 — authoritative source lives there):**

1. `framework-pytest-fixture` (Axis C, predicate)
2. `framework-flask-route` (Axis C, predicate)
3. `framework-component-decorator` (Axis C, predicate)
4. `method-chain-dispatch` (Axis A+B, builtin)
5. `polymorphic-subtype-dispatch` (Axis B F7, builtin)
6. `dynamic-property-keyed-callback` (Axis B F9, builtin)
7. `constructor-new-expression` (Axis A, builtin)
8. `python-module-attribute-call` (Axis B F4, predicate)
9. `aliased-re-export-walk-broken` (Axis B F5, builtin)
10. `unindexed-external-module` (Axis B F6, predicate)

**Comparison dimensions for each reference case:**

- **Coverage** — Does the generated registry contain a classifier that matches this group (same semantic intent, even if the `group_id` or predicate shape differs)?
- **Predicate equivalence** — If coverage exists, is the generated predicate logically equivalent to the reference? If it's narrower, does the webpack data justify the narrowing? If it's broader, does it admit false positives the reference wouldn't?
- **Axis / kind alignment** — Is the generated classifier the same axis/kind as the reference? Divergences here often indicate the curator saw the group through a different signal than expected.
- **Precision** — Does the generated classifier meet `min_confidence` on fixtures drawn from the webpack triage output for this group?

**Expected outputs:**

- A markdown audit report at `.claude/skills/triage-curator/audits/webpack_bootstrap_vs_reference.md` with one section per reference case: `{ status: covered | partial | missing, generated_group_id?, divergence_notes, justification }`.
- For each `missing` case: an investigation. If the webpack data contains entries that should have seeded the group but the curator missed them, either (a) file a follow-up task to extend the curator's group-seeding heuristics, or (b) manually seed the classifier via a human-authored `ClassifierSpec` + `.ts` file and note the reason.
- For each novel (non-reference) classifier the curator produced: a one-paragraph justification tied to the webpack entries that seeded the group. Novel groups are expected and desirable — they indicate the curator saw patterns the hand-designed taxonomy missed.
- An updated registry where every reference case is either covered by a classifier or explicitly marked with `coverage: "intentionally_deferred"` and a link to the rationale.

**Scope boundary:** this task does not add or refine classifiers beyond closing gaps relative to the reference. Broader refinement (precision tuning, new axes) belongs to the curator's ongoing cadence (TASK-190.16.7 dispatchers + TASK-190.16.10 residual-only workflow).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Audit report `.claude/skills/triage-curator/audits/webpack_bootstrap_vs_reference.md` exists with one section per reference case tagged `covered` / `partial` / `missing`
- [ ] #2 Every reference case is either covered by a generated classifier (possibly with a different `group_id`) or has a documented rationale for being deferred
- [ ] #3 Every `partial` case includes a divergence analysis: narrower / broader predicate, alternate axis, or different signal — plus whether the webpack data justifies the divergence
- [ ] #4 Every novel (non-reference) classifier produced by the curator is justified against specific webpack triage entries in the report
- [ ] #5 Gaps identified as seeding-heuristic bugs in the curator are filed as follow-up tasks linked to TASK-190.16.7
- [ ] #6 Gaps closed by human-authored classifiers (rather than deferred) follow the same test-coverage requirement as TASK-190.16.8 AC #3 (co-located `.test.ts` with webpack-derived fixtures)
- [ ] #7 After this task, auto-classified ÷ total flagged on the webpack corpus still meets the ≥40% bar from TASK-190.16.8 AC #6 (no regression from reconciliation work)
<!-- AC:END -->
