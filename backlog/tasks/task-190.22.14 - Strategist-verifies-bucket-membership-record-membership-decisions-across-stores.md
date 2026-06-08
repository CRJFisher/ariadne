---
id: TASK-190.22.14
title: >-
  Strategist verifies bucket membership; record membership decisions across the
  stores
status: To Do
assignee: []
created_date: '2026-06-08 00:00'
labels:
  - self-repair
  - plan-skill
  - plan-strategist
dependencies:
  - TASK-190.22.10
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Pass A (`group_fault_areas`) buckets every false-positive by `derive_fault_area`
— a deterministic lookup over the `diagnosis` + `(stage, reason)` signal core
emits. It is total and cheap, but it can mis-route: a member can land in a bucket
whose bulk root cause it does not actually share — a borderline `(stage, reason)`,
a defaulted derivation (`needs_judgement: true`), or a genuinely cross-area fault.

Today the strategist must plan over **every** member it is handed. A mis-routed
member is therefore baked into a node's `evidence_indices`, into the evidence that
aggregates up the tree, and so into the `PlanTask.dedup_key` — grounding a fix on
evidence that belongs to a different fault, and skewing the bucket's rollup
(`observed_count`, `projects`).

The strategist is the one stage with judgement and code access
(`Read`/`Grep`/`Glob`). Before it plans, it should **verify the members it
received**: confirm each genuinely belongs to this group's bulk and flag the
outliers, so a fix is only ever grounded on members that share its root cause.

## Scope

- The `plan-strategist` emits a **per-member membership verdict** over the
  bucket's `evidence[]`: for each index, `belongs` (in the group's bulk) or
  `does-not-belong`, with a short reason and — when it can tell — the
  `AriadneFaultArea` the member should route to instead. `needs_judgement`
  members are the priority to adjudicate.
- A member judged not to belong is **excluded from this bucket's plan**: no node
  may carry its `evidence_index`, so it never enters a node's aggregated evidence
  or a `PlanTask.dedup_key`, and the bucket rollup counts confirmed members only.
- `validate_plan` enforces the review is **total** (every evidence index carries a
  verdict) and **consistent** (no node grounds an excluded index; every exclusion
  carries a non-empty reason).
- Pass C consumes the verdicts and **updates the stores so membership is correctly
  recorded**:
  - `build_plan_tasks` aggregates evidence and computes `dedup_key` from
    **confirmed members only**.
  - The reconcile pass records each membership decision as a new `PlanSweepEvent`
    (audit trail), and writes excluded members to a **membership-override store**
    keyed on a stable member identity, so a mis-routed member is neither silently
    lost nor re-rejected on every future sweep.
  - A confirmed mis-route surfaces as a `derive_fault_area` **correction signal**
    (same spirit as the `other`-bucket taxonomy-extension path), so the systematic
    fix lands in the taxonomy rather than being re-adjudicated each sweep.
- Planning-only + write-boundary contract preserved: the strategist writes only
  its `StrategistPlan` JSON; the deterministic reconcile pass remains the sole
  writer of the task-DB and the membership-override store; no new tool grant (the
  strategist already holds `Read`/`Grep`/`Glob`).

## Open design decisions (resolve in implementation)

1. **Verdict shape.** A first-class `membership: { index, belongs, reason,
   suggested_area? }[]` on `StrategistPlan`, vs. an `excluded_evidence_indices`
   list with reasons. Recommend the explicit per-index review so the validator can
   require totality.
2. **What happens to an excluded member.** (a) exclude-this-sweep-only, (b) a
   persistent membership-override keyed on member identity that future sweeps
   respect, (c) emit a `derive_fault_area` correction task. Recommend **(b) + (c)**:
   the override stops re-rejection now, the correction signal fixes the root cause.
   Note (a) alone fails — because every sweep re-buckets via `derive_fault_area`,
   the same member would be re-routed to the wrong bucket and re-rejected forever.
3. **Member identity for the override store.** Must be line-drift-stable — this
   ties into the `dedup_key` symbol-identity work (the `file:line` token is not
   stable across edits). Key the override on symbol identity, not `file:line`.
4. **Cross-area members.** A member that legitimately spans two areas — keep or
   split? Recommend: it `belongs` if it shares the bulk root cause; a true
   cross-area fault is the `architectural` root's job, not an exclusion.

## Verification

A strategist plan that excludes a mis-routed member produces `PlanTask` rows whose
evidence and `dedup_key` omit that member; a `PlanSweepEvent` records the
exclusion; the excluded member is written to the membership-override store.
`validate_plan` rejects a plan that leaves an evidence index unreviewed or grounds
a node on an excluded index. A re-sweep does not re-reject a member already
recorded in the override store. The plan engine makes zero writes to `backlog/`,
`registry.json`, or `packages/core`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The `plan-strategist` emits a total per-member membership verdict over the bucket's `evidence[]` (`belongs` / `does-not-belong` + reason, optional `suggested_area`); the agent prompt and `get_bucket_context` surface the review rule, prioritising `needs_judgement` members
- [ ] #2 `validate_plan` requires every evidence index to carry a verdict, forbids any node from grounding an excluded index, and requires a non-empty reason on each exclusion
- [ ] #3 Pass C grounds tasks on confirmed members only — `build_plan_tasks` excludes rejected indices from evidence aggregation, `dedup_key`, and the rollup; a new `PlanSweepEvent` records each membership decision
- [ ] #4 Excluded members are written to a membership-override store keyed on a line-drift-stable member identity, so they are neither silently lost nor re-rejected each sweep; a confirmed mis-route surfaces as a `derive_fault_area` correction signal
- [ ] #5 Planning-only + write-boundary contract preserved (strategist writes only its plan; reconcile is the sole writer of the task-DB and membership store; no new tool grant)

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

To be completed on execution. Resolve the four open design decisions above before
coding; decisions 2 and 3 are coupled to the `dedup_key` symbol-identity hardening
(both need a member identity that survives line drift) and should be settled
together. Until then, prefer the recommended defaults: a first-class per-index
membership review on `StrategistPlan`, a persistent override store keyed on symbol
identity, and a `derive_fault_area` correction signal for systematic mis-routes.

<!-- SECTION:NOTES:END -->
