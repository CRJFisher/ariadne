---
id: TASK-190.18.2
title: Stamp `touched_files` and `cluster_hint` onto curator-filed backlog tasks
status: To Do
assignee: []
created_date: "2026-04-29 10:30"
labels:
  - self-repair
  - fix-sequencer
  - triage-curator-extension
  - critical-path
dependencies: []
parent_task_id: TASK-190.18
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The investigator already knows likely fix locations from its evidence collection; today they're stranded in prose. Persist them as structured fields so clustering has a deterministic input — without this signal, fix-sequencer's two-stage clustering collapses to category-only grouping (much weaker).

## Scope

- File: `.claude/skills/triage-curator/src/propose_backlog_tasks.ts` (and the schema validator that backs it)
- Add `touched_files: string[]` to the proposed task's frontmatter (best-effort; empty list valid)
- Add `cluster_hint: <root_cause_category>` as a label on each created ariadne-bug task
- Forward-only: existing TASK-190.16.x tasks are NOT backfilled (fix-sequencer treats absent `touched_files` as singleton-cluster signal)
- Validation: malformed `touched_files` (non-string entries, paths with `..`) rejected before write

## Critical-path

This subtask is part of the minimum-cut critical path — clustering quality is bounded by feature quality.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 propose_backlog_tasks.ts writes `touched_files: string[]` into task frontmatter
- [ ] #2 `cluster_hint: <root_cause_category>` written as a label on each created bug task
- [ ] #3 Existing tasks unaffected (only forward-going)
- [ ] #4 Validation rejects malformed `touched_files`
- [ ] #5 Unit tests cover empty-list, single-file, multi-file, and rejection cases
<!-- AC:END -->
