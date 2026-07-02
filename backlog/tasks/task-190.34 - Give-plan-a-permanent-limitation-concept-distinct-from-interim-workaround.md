---
id: TASK-190.34
title: "Give plan a permanent-limitation concept distinct from interim-workaround"
status: To Do
assignee: []
created_date: "2026-07-02 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - plan
  - taxonomy
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The regime is: the classifier registry holds classifiers **only** for call
relationships that are fundamentally unknowable to static analysis (permanent
limitations); fixable resolver bugs live in the backlog. A regime audit found the
**plan** stage's taxonomy names only the *wrong half* of this distinction.

### The mismatch

Plan marks classifier-relevant groups with `is_classifier_work`, documented and
pinned as an **interim workaround**:

- `plan_task.ts`: `is_classifier_work` is "an interim classifier-script work
  item — a workaround that routes triage around the false-positive **until the
  core fix lands**. … The core fix is always the real deliverable."
- `plan-strategist.md` H2 is titled **"The classifier is the interim mitigation"**
  ("a classifier routes triage around the false-positive **while a high-effort
  core fix waits**") — and this title is pinned by `agent_prompt_pin.test.ts`.

So plan has **no representation for a permanent limitation with no core fix**. Its
model assumes a durable core fix always exists and sizes the classifier as the
cheap interim. A strategist following the prompt literally would never surface a
pure permanent-limitation group as "classifier-only, no core fix." The entire
permanent-vs-fixable split is therefore deferred 100% to a human judgement call at
`prioritize` (step 3a), with **zero positive signal from plan** to route on — and
the strategist prompt actively biases toward "there is always a core fix," the
opposite of the permanent-limitation regime.

This does not cause a bad registry write (prioritize + the classifier-author
"stop if fixable" gate catch a misroute), but it means plan under-supports the
regime: the distinction is preserved by a human eyeball, not by plan's data model.

### The fix

Give plan a first-class signal for the two disjoint outcomes, e.g. split
`is_classifier_work` (or add a sibling field) into:

- **permanent-limitation** — no core fix is possible; the classifier is the
  durable deliverable (routes to `classifier-author`);
- **interim-workaround** — a fixable bug with a high-effort core fix pending; the
  classifier is a temporary mitigation and the core fix is the real deliverable
  (graduates to `backlog/`).

Update the strategist prompt (and its pinned test) so it can emit the
permanent-limitation case without asserting a durable core fix, and thread the
signal into the `PlanTask` so `prioritize` step 3a routes on data rather than a
pure human call. Keep the human as the final adjudicator, but give them (and the
pipeline) a real signal to start from.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Plan's taxonomy represents "permanent limitation (no core fix)" distinctly
      from "interim workaround (core fix pending)" — not just the interim case.
- [ ] The plan-strategist prompt can surface a permanent-limitation group without
      asserting a durable core fix exists; the pinned-prompt test is updated to
      match.
- [ ] The signal is threaded into `PlanTask` and consumed by `prioritize` step 3a
      so routing to `classifier-author` vs `backlog` starts from data, with the
      human as final adjudicator.

<!-- AC:END -->
