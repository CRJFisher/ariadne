---
id: TASK-190.34
title: "Give plan a permanent-limitation concept distinct from interim-workaround"
status: Done
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

Under the regime there is no such thing as an interim classifier: the registry
builtins are triage's only classifier mechanism and the registry holds only
permanent limitations, so a classifier for a fixable bug has nowhere to live.
Plan's `is_classifier_work` concept is therefore replaced, not renamed:

- Replace `is_classifier_work` with **`is_permanent_limitation`** on
  `StrategistPlanNode` and `PlanTask`: `true` marks a group whose call
  relationship is fundamentally unknowable to static analysis — no core fix is
  possible and the classifier is the durable deliverable (routes to
  `classifier-author`, never exports to `backlog/`); `false` is ordinary
  core-fix work.
- Purge the interim-workaround concept from plan everywhere it surfaces: the
  strategist prompt's "classifier is the interim mitigation" section (replaced
  by permanent-limitation guidance that does not assert a durable core fix
  exists), the rendered "author the interim classifier" acceptance criterion,
  the `--priority core|classifier` export partition, and
  `derive_backlog_priority`'s classifier→medium rule.
- Thread the signal into `PlanTask` and give `prioritize` step 3a a data
  surface to route on (a listing of permanent-limitation groups), keeping the
  human as final adjudicator.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] Plan's taxonomy carries "permanent limitation (no core fix possible)" as a
      first-class signal: `is_permanent_limitation` on `StrategistPlanNode` and
      `PlanTask`, replacing `is_classifier_work`.
- [x] The interim-workaround classifier concept is purged from plan: no prompt
      guidance, rendered acceptance criterion, export partition, or priority
      rule proposes an interim classifier for a fixable bug.
- [x] The plan-strategist prompt can surface a permanent-limitation group without
      asserting a durable core fix exists; the pinned-prompt test is updated to
      match.
- [x] Permanent-limitation tasks never export to `backlog/`; `prioritize` step 3a
      routes to `classifier-author` vs `refactor-investigator` starting from
      plan's data, with the human as final adjudicator.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The plan engine's taxonomy carries the permanent-limitation concept as a
first-class boolean. `is_permanent_limitation` on `StrategistPlanNode` and
`PlanTask` marks a group whose call relationship is fundamentally unknowable to
static analysis: no core fix is possible, and the durable deliverable is a
registry classifier authored downstream by `classifier-author`. Everything else
is ordinary core-fix work. There is no third state — under the
classifier-lifecycle regime the registry builtins are triage's only classifier
mechanism and the registry holds only permanent limitations, so an "interim
classifier" for a fixable bug has nowhere to live; plan therefore carries no
concept of one. That deletion is the decision that shaped the change: the field
is a replacement, not a rename, and the whole interim surface went with it —
the strategist's "classifier is the interim mitigation" guidance, the rendered
"author the interim classifier" acceptance criterion, the
`--priority core|classifier` export partition, and the classifier→medium
backlog-priority rule (every exported row is a core fix, stamped `high`).

The flag flows strategist → `validate_plan` → `build_plan_tasks` → the task-DB
row → export selection. `select_exportable_tasks` hard-excludes permanent rows
in both selection modes and reports them on the `skipped_permanent_limitation`
channel; that report, surfaced in the export dry run, is the listing
`prioritize` step 3a routes from — plan's flag is the routing default, the
human is the final adjudicator, and the agent gates (`classifier-author`'s
"if fixable, stop"; the investigator's `PERMANENT-LIMITATION` verdict) remain
the backstops in both directions.

Front doors: the field docs at `plan/src/types.ts` (`StrategistPlanNode`) and
`plan/src/store/plan_task.ts` (`PlanTask`); the strategist's pinned H2
"Permanent limitations — the no-fix escape" in `.claude/agents/plan-strategist.md`;
the export invariant in `plan/src/export/select_exportable_tasks.ts`; the
operator path in `prioritize/SKILL.md` steps 1–3a. Two guards keep the
never-export invariant structural: the store's parse boundary rejects a row
missing the boolean (a stale pre-rename file fails loudly instead of reading
falsy and silently exporting), and the reconcile augment re-adopts the
candidate's fresh flag each sweep, like `core_fix_effort`.

Known edge, deliberately left: `validate_plan`'s other-bucket rule counts an
evidence-grounded permanent-limitation node as the bucket's "core fix" — naïvely
excluding it would force a fake core-fix node on an all-permanent `other`
bucket, so tightening it needs a design decision, not a one-liner.

### Review

An 11-lens opus review verified the change and surfaced fixes, all applied: a
typecheck-only break in `graduate_group_docs.test.ts` (stale `ExportSelectors`
shape — vitest strips types, so only `tsc --noEmit` caught it), the augment
re-adoption and parse-boundary guards above, the stale `--priority` references
in `PlanTask.core_fix_effort`'s doc and
`docs/self-healing-pipeline/actuate-and-backlog.html`, and the prioritize
SKILL's broken operator path (step 1 never named the
`skipped_permanent_limitation` array; step 3a pointed at step 2's candidate
grouping, which permanent rows never enter). Considered, not actioned: the
skip channel staying `string[]` (id-only is sufficient), a smoke-test
permanent-node fixture (unit coverage exists at every stage), and a strategist
prompt instruction to code-ground the permanence call (the downstream gates
re-adjudicate by design).
