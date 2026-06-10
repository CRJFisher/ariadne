---
id: TASK-190.22.4-pre-renumber
title: 'Deferred — in-run novel-issue coordinator (src/absorb/*, parked)'
status: To Do
assignee: []
created_date: '2026-06-01 10:46'
labels:
  - self-repair
  - deferred
  - parked
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Pre-renumber artifact.** This file's `id` was re-keyed from `TASK-190.22.4` to `TASK-190.22.4-pre-renumber` in TASK-190.22.20: the `190.22.4` slot was reassigned to the plan task-DB contract task after an epic subtask renumber. See `backlog/tasks/task-190.22.4 - Define-the-plan-task-DB-contract…md` for the current `TASK-190.22.4` holder. The coordinator code this file parked (`src/absorb/*`) was deleted in Phase 1 (TASK-190.22.1).

## Why this is parked

The golden `triage` path (TASK-190.22.1) collects raw false-positive signal at finalize and does NO in-run novel-issue dedup; grouping happens offline in the `plan` skill. The in-run coordinator subsystem — built in TASK-190.19 (May 23) but never wired to a dispatcher — is therefore taken off the hot path and parked, not deleted. This task records the intent so it can be revisited or formally retired.

## Parked-code inventory

- `.claude/skills/triage/src/absorb/{absorb_verdict,coordinator_decision,coordinator_apply_decision,coordinator_prompt,coordinator_log,novel_issues}.ts` + their colocated `.test.ts` (kept compiling; `novel_issues.ts` still exports the `NovelIssue` type consumed by finalize/the shared contract).
- `.claude/agents/triage-coordinator.md` (defined, never invoked).
- The `coordinator_log.jsonl` path helper and the `novel_issues.json` run-state path.

## What was removed from the hot path (TASK-190.22.1)

The `novel_issues_snapshot` dispense field, the investigator's in-run `fp-novel-cited` early-exit, and the `Task(triage-coordinator)` grant + coordinator prose in `SKILL.md`.

## Un-park decision (when revisited)

Pick one:
- **Wire it:** write the dispatcher that calls `absorb_verdict()` on each investigator result and routes novel verdicts through `Task(triage-coordinator)` to write `novel_issues.json` — only if in-run dedup proves worth the hot-path complexity.
- **Retire it:** delete `src/absorb/*` + `triage-coordinator.md` once the offline grouping in `plan` (TASK-190.22.3) fully subsumes the need.

This is tier-2; it does not block the golden path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 This task remains the record of the parked `src/absorb/*` coordinator until it is either wired (dispatcher) or retired (deleted)
- [ ] #2 When revisited, the un-park decision is made explicitly and this task closed with the outcome
<!-- AC:END -->
