---
id: TASK-190.27
title: "Prioritize skill: add a fix-history archaeologist sub-agent that mines prior attempts at the same fault"
status: To Do
assignee: []
created_date: "2026-06-26 00:00"
labels:
  - self-repair
  - prioritize
  - investigation
parent_task_id: TASK-190
priority: medium
---

## Description

The `prioritize` skill's deep-investigation step (step 3) dispatches one
`refactor-investigator` per change group to design a code-grounded fix against
the current `packages/core`. That investigation reads the code **as it is now**
— it has no view of the repo's history. When a fault area resurfaces, the
investigator re-derives a fix blind to the fact that this exact issue (or a close
neighbour) was already attempted before, and may re-propose a variant of a fix
that already proved insufficient.

The most valuable signal for designing a durable fix is often the record of the
**previous attempt**: what was changed, why it was thought to resolve the issue,
and why it did not hold. A fault that crops up again after a prior landed fix is
direct evidence that the earlier fix addressed a symptom rather than the root
cause, or that the root cause has a wider blast radius than the first attempt
assumed. Surfacing that history turns "design a fix" into "design a fix that does
not repeat the mistake that let this regress."

Add a sub-agent to `prioritize` that searches back through git history for changes
made in the same parts of the repo as the change group under investigation,
tracking down prior fix attempts on similar functionality — especially cases where
an attempt was already made on the **specific** issue that has now recurred — and
feeds the findings into the investigation as crucial data guiding an improved fix.

## Why

- A recurring fault is the clearest available signal that a prior fix was
  insufficient; without history the investigator cannot see it and risks
  re-proposing the same shape of fix.
- The "why it wasn't enough" of a previous attempt is high-density root-cause
  evidence that the current code alone does not contain — it lives in the diff,
  the commit message, and the task/PR that motivated the earlier change.
- Feeding prior-attempt context into `refactor-investigator` raises the chance
  the graduated backlog task carries a genuinely root-cause fix rather than
  another symptom patch, which is the whole point of the deep-investigation step.

## Changes

**New sub-agent — fix-history archaeologist** (`.claude/agents/<name>.md`)

Receives one change group's fault area and the concrete files / symbols /
fault-area folder the `refactor-investigator` is about to design against. It then
mines git history for prior work on that same surface:

- Walk `git log` over the fault-area folder and the specific files cited in the
  change group's rows (e.g. `git log --follow -p -- <path>`), and search commit
  subjects/bodies for the fault-area and the symptom (`git log --grep`), including
  the Conventional-Commits `fix(...)` / `feat(...)` scopes that link to backlog
  task ids (see `.claude/rules/commit-convention.md`).
- Identify **prior fix attempts** at the same functionality — and flag the
  strongest case: a previous commit that targeted **this specific issue** which
  has now recurred. Use the registry/backlog audit trail where it exists: a
  `fixed`-flipped classifier row's `backlog_task` plus the fix-bearing commit is
  the explicit prior-attempt link (`.claude/rules/classifier-lifecycle.md`).
- For each prior attempt, reconstruct: what was changed, the stated intent (commit
  message / linked task), and — the crucial output — a hypothesis for **why it was
  insufficient** (wrong altitude, narrow special-case, missed a sibling code path,
  fixed the symptom not the cause), grounded in the diff and the fact of
  recurrence.
- Write its findings to the group's staging dir
  (`<root>/<fault_area>/fix_history.md`) as structured prior-attempt evidence the
  investigator consumes.

**Structured commit-message convention for fault-area discoverability**
(`.claude/rules/commit-convention.md`)

The archaeologist's search is only as good as the history is greppable. Today
commits are keyed by task-id scope (`fix(343): …`), which links a commit to a
backlog task but not to the **fault area** it touched — so finding "every prior
attempt on _this_ part of the repo" relies on path heuristics and free-text
grep. Extend the commit convention with a structured, machine-greppable marker
that names the fault area / functional surface a fix targets, so a recurrence can
be traced to its prior attempts by an exact match rather than a guess.

- Add a convention (e.g. a `Fault-Area: <AriadneFaultArea>` trailer, or a scope
  sub-component) that fix/feat commits touching a known fault area carry, drawing
  the vocabulary from the existing `AriadneFaultArea` taxonomy so the marker is a
  closed, known set rather than free text.
- The marker must be stable and exact-greppable (`git log --grep="Fault-Area: <area>"`)
  so the archaeologist can enumerate prior attempts on one surface deterministically,
  and so it composes with the existing task-scope and the `fixed`-row `backlog_task`
  audit trail.
- Keep it permissive and additive: it complements the existing scope rules
  (`.claude/rules/commit-convention.md`), is validated only when present, and does
  not break the current `commit-msg` hook contract. Document it in the convention
  rule and reflect it in the archaeologist's search strategy above.

**Updated `prioritize` workflow** (`.claude/skills/prioritize/SKILL.md`)

- Wire the archaeologist into step 3 so its `fix_history.md` is on disk for the
  group **before** that group's `refactor-investigator` designs its fix — either
  as a pre-pass feeding the investigator, or as a parallel pass the investigator
  reads. The investigator's dispatch prompt must direct it to read
  `fix_history.md` and explicitly account for why any prior attempt was
  insufficient when choosing the fix altitude.
- Keep the design-only boundary: the archaeologist reads git history and
  `packages/core` but writes only its staging artifact; it never writes
  `packages/core`, the registry, or `backlog/`.
- Reflect the new artifact in the staging-root layout documented in the skill.

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A fix-history archaeologist sub-agent exists under `.claude/agents/` with a
      scoped tool allowlist (git-log reads, code reads, write only to its staging
      artifact).
- [ ] The agent surfaces prior fix attempts on the change group's surface,
      explicitly flagging any previous attempt on the **same** recurring issue,
      and for each produces a "why the previous fix wasn't sufficient" hypothesis
      grounded in the diff and recurrence.
- [ ] `prioritize` SKILL.md is updated so the archaeologist's `fix_history.md` is
      produced before/for each group's `refactor-investigator`, the investigator's
      prompt directs it to consume that history and account for the prior attempt's
      insufficiency, and the new staging artifact is documented.
- [ ] The new step preserves the existing step-3 → step-4 ordering barrier and the
      investigator's design-only boundary.
- [ ] `.claude/rules/commit-convention.md` defines a structured, exact-greppable
      fault-area marker (drawn from the `AriadneFaultArea` taxonomy) that fix/feat
      commits carry, the archaeologist's search uses it to enumerate prior attempts
      on a surface, and the marker is additive — it does not break the existing
      `commit-msg` hook contract.

<!-- AC:END -->
