---
id: TASK-190.26
title: "Prioritize skill: auto-investigate change groups before funding decision"
status: To Do
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
  (≤5/wave) on all candidate groups.
- New step 4: render one `comprehension-doc-architect` HTML per group from its
  refactor plan.
- Updated step 6 (promote): graduate each funded group's
  `refactor_plan.md` → `backlog/docs/TASK-<id>-…-refactor.md` and
  `comprehension.html` → `backlog/tasks/task-<id>.overview.html` alongside its
  epic. Unfunded groups' docs stay in staging.

The `plan` engine and its strategist are unchanged — they remain the cheap,
planning-only router-and-estimator. All new deep-design work lives in
`prioritize`, the stage already licensed to write `backlog/`.

## Acceptance criteria

- [ ] `refactor-investigator` agent exists and produces a 9-section refactor plan
      for any fault-area change group from the plan task-DB.
- [ ] `prioritize` dispatches one investigator per change group before
      `AskUserQuestion`, in parallel, on all candidate groups.
- [x] Funded-group refactor plans and comprehension docs graduate into `backlog/`
      alongside the epic on promotion (`graduate_group_docs.ts` — pipes from
      `export_to_backlog.ts`, copies staged docs to `backlog/docs/` and
      `backlog/tasks/`, idempotent).
- [ ] `plan` strategist prompt, tool grant, and write boundaries are unchanged.
