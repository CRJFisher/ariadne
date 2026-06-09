---
id: TASK-190.22.14
title: >-
  Strategist verifies bucket membership; record membership decisions across the
  stores
status: Done
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

- [x] #1 The `plan-strategist` emits a total per-member membership verdict over the bucket's `evidence[]` (`belongs` / `does-not-belong` + reason, optional `suggested_area`); the agent prompt and `get_bucket_context` surface the review rule, prioritising `needs_judgement` members
- [x] #2 `validate_plan` requires every evidence index to carry a verdict, forbids any node from grounding an excluded index, and requires a non-empty reason on each exclusion
- [x] #3 Pass C grounds tasks on confirmed members only — `build_plan_tasks` excludes rejected indices from evidence aggregation, `dedup_key`, and the rollup; a new `PlanSweepEvent` records each membership decision
- [x] #4 Excluded members are written to a membership-override store keyed on a line-drift-stable member identity, so they are neither silently lost nor re-rejected each sweep; a confirmed mis-route surfaces as a `derive_fault_area` correction signal
- [x] #5 Planning-only + write-boundary contract preserved (strategist writes only its plan; reconcile is the sole writer of the task-DB and membership store; no new tool grant)

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

Pass A buckets every triage false-positive by `derive_fault_area`, a deterministic
lookup that can mis-route a member into a bucket whose bulk root cause it does not
share. The strategist used to plan over every member it was handed, so a mis-route
was baked into a node's evidence, the evidence that aggregates up the tree, and the
`PlanTask.dedup_key` — grounding a fix on evidence that belongs to a different
fault. The strategist is the one stage with judgement and code access, so before it
plans it now **verifies the members it received**.

The strategist emits a first-class `membership: MembershipVerdict[]` on its
`StrategistPlan` — one verdict per evidence index (`belongs` / not, a reason, and an
optional `suggested_area`). `validate_plan` makes the review **total** (a verdict
for every index) and **consistent** (no node may ground a `belongs: false` index,
and an exclusion carries a non-empty reason and a `suggested_area` that is a real
area other than the bucket's own). Because the validator rejects a plan that grounds
an excluded index, `build_plan_tasks` grounds confirmed members only by
construction — no change to its aggregation, so the evidence, rollups, and
`dedup_key` exclude rejected members automatically.

The reconcile pass records each exclusion three ways: an `exclude_member`
`PlanSweepEvent` (audit), a record in a new membership-override store
(`~/.ariadne/plan/membership_overrides.json`), and — when the exclusion names a
`suggested_area` — a `derive_fault_area` correction signal in the sweep summary.
Pass A consults the override store and **re-routes** a recorded mis-route to its
suggested area, or **suppresses** it when none was suggested, so a settled mis-route
is corrected on the next sweep rather than re-adjudicated forever.

**Member identity.** The override store keys on a `MemberSymbol`
(`file_path, name, kind, start_line`) — the flagged entry point's coordinate
identity, the same tuple the triage TP cache treats as a cross-machine match key —
threaded `NovelIssue → PlanTaskEvidence`. A true branded `SymbolId` is not
constructible anywhere on the entry-point → triage → plan path (core carries no
columns or end-line), so this is the most stable identity available. It is
drift-tolerant on `(file_path, name, kind)`; `start_line` is a collision-breaker
that still shifts, so a line-moved member re-enters the review. Full line-drift
immunity is deferred symbol-graph-identity work.

**Where to read.** The verdict shape lives in `plan/src/types.ts`; the validator
rules in `propose/validate_plan.ts`; the identity recipe + store in
`store/membership_override.ts`; the exclusion recording in
`reconcile/record_membership_decisions.ts`; the Pass A re-route in
`group/group_fault_areas.ts`; the wire-contract additions in
`@ariadnejs/skill-protocol` (`MemberSymbol`, `member_symbol` on `NovelIssue` /
`PlanTaskEvidence`, the `exclude_member` event). The strategist's instructions are
in `.claude/agents/plan-strategist.md` ("Verify bucket membership").

**What to watch.** `dedup_key` is unchanged — it still keys on the call-site
`file:line` set (exact-overlap task reconciliation), a deliberately separate
primitive from the member identity that routes a single member. No `schema_version`
bumps: there is no persisted data yet, so the new required fields are added in place.
Re-routing is single-step from the derived area; a suggested area that is itself
wrong is a fresh mis-route the strategist reviews again, and the
`derive_fault_area` correction signal is the durable fix. Suppression persists until
a human clears the override file.

### Implementation details

- **Contracts (`@ariadnejs/skill-protocol`):** `MemberSymbol` added (triage_results.ts)
  and exported; `member_symbol` added to `NovelIssue` and `PlanTaskEvidence`;
  `exclude_member` added to the `PlanSweepEvent` union; `plan_membership_overrides_path()`
  added to paths.ts. No `schema_version` bumps.
- **Producer (triage):** `output.ts` builds `member_symbol` from the entry via
  `entry_ref` (shared kind-check + `project_path`-relative `file_path`).
- **Plan engine:** `MembershipVerdict` + `membership` on `StrategistPlan`;
  `get_bucket_context` surfaces `needs_judgement_indices` + the membership-review
  rule; `validate_plan` gains totality / consistency / reason / suggested-area
  checks; `group_fault_areas` takes `overrides` and re-routes/suppresses (kept pure;
  `group_runs.ts` reads the store); `record_membership_decisions.ts` collects
  exclusions and writes events + override records + corrections; `reconcile_plan.ts`
  wires it and surfaces `excluded_members` + `derive_fault_area_corrections` in the
  summary.
- **Review fixes applied:** `upsert_many` now `mkdir`s the plan root (the store is
  self-sufficient, not reliant on a prior task write); `validate_plan` forbids a
  `suggested_area` equal to the bucket's own area (a non-converging self-re-route);
  `member_identity_token` joins fields in `MemberSymbol` declaration order;
  `needs_judgement`/`description` are folded only when a member stays in its derived
  area; docs softened from "line-drift-stable" to the honest `start_line` caveat;
  added the dedup-key-vs-member-identity rationale, an AC#3 positive test, and an
  end-to-end feedback-loop test (exclude → store → next-sweep re-route).

<!-- SECTION:NOTES:END -->
