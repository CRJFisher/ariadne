---
id: TASK-190.22.20
title: Reconcile epic 190.22 bookkeeping with reality
status: Done
assignee: []
created_date: '2026-06-09 20:06'
updated_date: '2026-06-10 09:14'
labels:
  - self-repair
  - backlog-hygiene
dependencies: []
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

A completeness audit found the epic's own records contradict the shipped state. The implementation (.1–.11, .13, .14) is done and green, but the bookkeeping is unauditable — the epic reads as untouched, one subtask's outcome was reversed without a record, and three task docs assert enforcement machinery that was deliberately removed.

## Scope (all verified)

1. **Epic file** (`backlog/tasks/task-190.22 - Restructure-self-healing-pipeline-…md`): status is `To Do` with 0/8 acceptance boxes despite 13/13 live subtasks Done. Tick the ACs verified in code (#2, #4–#8); annotate that the remaining gate is the real-data end-to-end run (AC #1/#3) — `~/.ariadne/plan/tasks/` has zero rows; passes B–C have only fixture smoke-test coverage.

2. **190.22.12 hole**: the epic lists it ("archive-not-delete" migration of 234 tickets), but no task file exists anywhere — commit 12371b99 ran the migration, commit 46aa55e4 reversed it (DB wiped, migration script AND task doc deleted). Record the reversal where the epic's subtask list points, so the audit trail isn't only in commit messages. Related: that migration cleared 117 `backlog_task` links in `.claude/skills/triage/known_issues/registry.json` whose replacement rows were then wiped — those rules now have no live task pointer; decide and record how they get re-linked (likely: the next real plan sweep + export).

3. **Stale firewall claims**: 190.22.7's deliverables (`backlog-firewall.md`, `backlog_writers.test.ts`, `ALLOWED_BACKLOG_WRITERS`) were deliberately deleted in c5c2ccd7; the task file carries no retirement note, and 190.22.10 AC#4 + 190.22.11 AC#1/#5 still claim "passes the 190.22.7 firewall test". Annotate all three: the sole-backlog-writer property is now convention, documented in plan/SKILL.md + prioritize/SKILL.md.

4. **190.22.13**: status Done with 0/4 AC boxes ticked; the work is verified in code (`core_fix_effort` on plan_task.ts/types.ts, `core_fix_effort_invalid` in validate_plan.ts, carry-through, prompt guidance). Tick the boxes.

5. **190.22.6** line ~88: unchecked "follow-up to-do" (PlanTaskId grammar → retarget `existing_task_id`) is moot — 190.22.9 deleted `InvestigateResponse`/`AriadneBug`; `existing_task_id` greps to nothing. Close with a note.

6. **Archive id collision**: `backlog/archive/tasks/task-190.22.4 - Deferred-—-in-run-novel-issue-coordinator-src-absorb-parked.md` is a pre-renumber artifact whose frontmatter id `TASK-190.22.4` (status To Do) collides with the live Done contract task. Re-id or annotate the archive file.

7. **Unfiled follow-ups now filed**: the .9 review's IA follow-ups (`src/propose/` dissolution, validate_plan twin-filename) are covered by TASK-190.22.18; .14's deferred line-drift-stable member identity remains disclosed-but-unfiled — file it or record the decision not to.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Epic task-190.22 status and AC checkboxes reflect verified reality, with the real-data end-to-end run recorded as the sole remaining gate
- [x] #2 The 190.22.12 reversal (migration run, then DB wiped and task doc deleted) is recorded in the epic's subtask list, including the disposition of the 117 registry rules with cleared backlog_task links
- [x] #3 Task docs 190.22.7, 190.22.10, and 190.22.11 each carry a note that the firewall enforcement was retired in c5c2ccd7 and the sole-backlog-writer property is convention documented in the SKILL.md files
- [x] #4 190.22.13's AC boxes are ticked and 190.22.6's moot follow-up checkbox is closed with a one-line note
- [x] #5 The archived pre-renumber task no longer collides with live id TASK-190.22.4, and the .14 member-identity deferral is either filed as a task or recorded as won't-do
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

Audits the epic 190.22 task tree and corrects every record that contradicted the shipped state. No code changes; all changes are backlog and documentation.

## What changed

**Epic file (190.22):** Status flipped `To Do → In Progress`; ACs #2, #4, #5, #6, #7, #8 ticked. Implementation notes added identifying the sole remaining gate: ACs #1 and #3 require a real-data end-to-end run (`~/.ariadne/plan/tasks/` has zero rows). Subtask intro corrected from "hardening tasks" to "tasks (hardening, doc corrections, bookkeeping)". The .20 self-reference `_(this task)_` removed.

**190.22.12 reversal record:** Epic subtask entry rewritten to document the full story: migration ran (12371b99), task-DB wiped and task doc deleted (46aa55e4), and 117 of the 234 migrated tasks had `registry.json` `backlog_task` back-links that now dangle. The misattributed "re-linked when a plan sweep runs" phrasing replaced with the correct actor: the human re-links them (registry is human-maintained per `.claude/rules/classifier-lifecycle.md`).

**Stale firewall references:** Task docs 190.22.7, 190.22.10, and 190.22.11 each received a note that the `backlog_writers.test.ts` AST enforcement (retired in c5c2ccd7) is now convention in `.claude/skills/plan/SKILL.md` and `.claude/skills/prioritize/SKILL.md`. The epic's .7 subtask entry standardized to struck-through title + `_Retired in c5c2ccd7._` phrasing, matching the .12 entry's visual convention.

**190.22.13:** All 4 AC boxes ticked — `core_fix_effort` field and its validation are verified in `plan_task.ts`, `types.ts`, `validate_plan.ts`.

**190.22.6 follow-up:** Checkbox marked done with a one-line moot note (`existing_task_id` deleted in 190.22.9); the original instruction prose struck through to prevent a reader from acting on superseded instructions.

**Archive id collision:** `backlog/archive/tasks/task-190.22.4 - …parked.md` renamed via `git mv` to `task-190.22.4-pre-renumber - …parked.md`; frontmatter `id` already changed in the prior session. A pre-renumber context note added to the description explaining the reassignment.

**HTML companions:** Epic overview updated `.20` row from `TO DO` to `IN PROGRESS` (new `.s-wip`/`.d-wip` CSS classes added). Reconciliation map status chip updated `To Do → In Progress`; archive id typo `TASK-190.22.4-prerenumber` corrected to `TASK-190.22.4-pre-renumber`.

## Review findings actioned (second pass)

The initial implementation was reviewed by 10 fable agents across all lenses. Second-pass fixes applied:

- Archive filename/frontmatter mismatch resolved via `git mv` (5 lenses flagged it)
- `prioritize/SKILL.md` added to all 4 retirement note sites (task scope named it; 3 lenses corroborated)
- `.12` actor attribution corrected + 234/117 relationship explained (5 lenses, cold-read rated it major)
- `.6` stale prose struck through (4 lenses, cold-read rated it major)
- `.7` subtask formatting standardized to match `.12` convention (2 lenses)
- HTML status staleness fixed (4 lenses)

Considered and not actioned: `.13` notes saying "firewall guards are green" without caveat (60% confidence, below gate); `.14` deferral section partially duplicating "Member identity" paragraph (70%); `.7` retirement note placement (70%); `backlog/companions/` dual-location (out of scope).
<!-- SECTION:NOTES:END -->
