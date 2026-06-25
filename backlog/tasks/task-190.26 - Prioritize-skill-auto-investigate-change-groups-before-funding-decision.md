---
id: TASK-190.26
title: "Prioritize skill: auto-investigate change groups before funding decision"
status: Done
assignee: []
created_date: "2026-06-25 00:00"
labels:
  - self-repair
  - prioritize
  - plan
parent_task_id: TASK-190
priority: medium
---

## Description

The `prioritize` skill currently builds a thin decision-aid comprehension doc
from the plan engine's row prose before asking the human which change groups to
graduate. The plan's architectural-node bodies are cheap hypotheses (the
strategist trusts the triage evidence rollup, spot-checks at most a few lines,
and is barred from reading the code front to back) — the human has been deciding
on unverified designs and hand-authoring the real refactoring plans post-export.

Add a deep-investigation step to `prioritize` that runs **before** the funding
decision, on **all** candidate change groups, so the human decides with verified,
code-grounded designs in hand.

## Changes

**New sub-agent — `refactor-investigator`** (`.claude/agents/refactor-investigator.md`)  
**New sub-agent — `refactor-task-architect`** (`.claude/agents/refactor-task-architect.md`)

`refactor-task-architect` receives one `refactor_plan.md` and produces a
`BacklogIdAssignment` map that reflects the investigator's grounded verdict:
one top-level task for the fundamental refactor, with sub-tasks only where the
investigator identified a genuinely separate downstream adaptation (e.g.,
language-specific consumer changes). It never re-introduces the plan engine's
original leaf decomposition unless the investigator's plan validates each leaf
as an independently addressable change.

**`refactor-investigator`** (`.claude/agents/refactor-investigator.md`)
Receives one change group (the `architectural` root, `fault_area` node, and
`localized` leaves for one `AriadneFaultArea`, with their false-positive
evidence). Reads the real `packages/core` code via the `ARIADNE_FAULT_AREA_FOLDER`
anchor, traces each FP to its root cause, and collapses the plan's decomposition
where needed — catching over-decomposition (N "independent" localized fixes that
are one cross-cutting change), dead code on the live path, and drifting duplicate
builders. Writes a 9-section Markdown refactor plan to
`~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`. Design-only: reads
`packages/core`, never writes it.

**Updated `prioritize` workflow** (`.claude/skills/prioritize/SKILL.md`)

- New step 3: dispatch one `refactor-investigator` per change group in parallel
  (≤5/wave) on all candidate groups. **All step-3 waves must complete before
  any step-4 task is dispatched** — the plans on disk are the verified input
  step 4 reads; this barrier must be stated explicitly in the skill spec.
- New step 4: render one `comprehension-doc-architect` HTML per group from its
  refactor plan (reads `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`
  from disk — the main agent does not transport the plan content in-memory).
- New step 6a: dispatch one **`refactor-task-architect`** agent per confirmed
  group before running the export scripts. The agent reads `refactor_plan.md`
  (sections 6 — sub-task mapping, and 7 — sequencing), applies the
  natural-split criterion ("fundamental refactor → top-level task;
  language-specific downstream adapter → sub-task"), and writes a
  `BacklogIdAssignment` map to
  `~/.ariadne/plan/prioritize/<fault_area>/task_assignment.json`. The plan
  engine's `tier` labels (`architectural`/`fault_area`/`localized`) are a
  routing concept and are not the right splitting axis.
- Updated step 6b (promote): `export_to_backlog.ts` gains an `--assignments
  <file>` flag that accepts the `task_assignment.json` produced by
  `refactor-task-architect`, bypassing `assign_backlog_ids`. Without the flag
  the script behaves exactly as today (backwards-compatible for non-`prioritize`
  callers). Graduate each funded group's `refactor_plan.md` →
  `backlog/docs/TASK-<id>-…-refactor.md` and `comprehension.html` →
  `backlog/tasks/task-<id>.overview.html` alongside its epic. Unfunded groups'
  docs stay in staging.

The `plan` engine and its strategist are unchanged — they remain the cheap,
planning-only router-and-estimator. All new deep-design work lives in
`prioritize`, the stage already licensed to write `backlog/`.

## Implementation Notes

### High-level summary

The implementation adds two investigation/assignment stages to `prioritize` that
run before any graduation decision. In step 3 the skill dispatches one
`refactor-investigator` per change group in parallel; an explicit barrier in
SKILL.md enforces that all waves complete before any comprehension-doc architect
is started in step 4. The investigator reads the real `packages/core` code via
the `ARIADNE_FAULT_AREA_FOLDER` anchor, traces each false-positive to its root
cause, and writes a 9-section `refactor_plan.md` to
`~/.ariadne/plan/prioritize/<fault_area>/`.

Step 6 is split into three sub-steps. Step 6a dispatches one
`refactor-task-architect` per confirmed group (all in parallel, then waits).
The architect reads sections 6 (sub-task mapping) and 7 (sequencing) of the
investigator's plan, applies the natural-split criterion — one top-level task
for the fundamental refactor, sub-tasks only for independently sequenced
downstream adaptations — and writes a `task_assignment.json` with relative
`BacklogIdAssignment` ids (`"1"`, `"1.1"`, …). Steps 6b and 6c then run per
confirmed group.

`export_to_backlog.ts` gains `--assignments <file>` (step 6b). When supplied,
`load_assignments` parses and validates the JSON (rejects non-dotted-decimal
`backlog_id` / `parent_backlog_id`), then calls `remap_assignment` to substitute
the absolute first-id for the relative root part. Tasks that share a `backlog_id`
(collapsed by the architect) are separated into a primary writer (lowest
`TIER_RANK`: `architectural` → `fault_area` → `localized`) and collapsed rows;
only the primary writes a backlog file but all are flipped to `exported` in the
DB. A write-time containment assertion blocks path-traversal in `backlog_id`
values that somehow pass format validation.

`export_to_backlog.test.ts` adds three tests: a pure-function unit test for
`remap_assignment` (root and nested cases), an integration test for the
collapse/dedup path (fault_area node collapses into root, leaf becomes sub-task,
all three DB rows flip), and a tier-rank primary-selection test (three rows
sharing one `backlog_id`, architectural wins).

## Acceptance criteria

- [x] `refactor-investigator` agent exists and produces a 9-section refactor plan
      for any fault-area change group from the plan task-DB.
- [x] `prioritize` dispatches one investigator per change group in parallel;
      **all step-3 waves finish before the first step-4 task is dispatched**
      (SKILL.md makes this barrier explicit).
- [x] `refactor-task-architect` agent exists; given a `refactor_plan.md` it
      produces a `task_assignment.json` that yields one top-level task per
      change group, with sub-tasks only where the investigator identified a
      genuinely separate downstream adaptation.
- [x] `export_to_backlog.ts` accepts `--assignments <file>` and, when supplied,
      uses the `BacklogIdAssignment` map from that file instead of computing
      ids from `assign_backlog_ids`.
- [x] Funded-group refactor plans and comprehension docs graduate into `backlog/`
      alongside the epic on promotion (`graduate_group_docs.ts` — pipes from
      `export_to_backlog.ts`, copies staged docs to `backlog/docs/` and
      `backlog/tasks/`, idempotent).
- [x] `plan` strategist prompt, tool grant, and write boundaries are unchanged.
