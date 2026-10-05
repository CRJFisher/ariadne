---
id: TASK-190.18.4
title: >-
  Add `reconcile_registry_with_completed_nodes.ts` as a `prepare_triage`
  pre-step
status: To Do
assignee: []
created_date: "2026-04-29 10:31"
labels:
  - self-repair
  - fix-sequencer
  - self-repair-pipeline-extension
  - loop-closure
dependencies:
  - TASK-190.18.3
parent_task_id: TASK-190.18
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

This is the missing arrow that closes the self-healing loop: a fix has landed in the worker (a `done` event in `state.jsonl`) but the registry still says `wip`, so the next pipeline run cannot distinguish expected FP→TP transitions from regressions.

## Scope

- New file: `.claude/skills/self-repair-pipeline/scripts/reconcile_registry_with_completed_nodes.ts`
- Reads `~/.ariadne/fix-sequencer/graph.json`
- Folds `~/.ariadne/fix-sequencer/state.jsonl` to find nodes whose latest event is `done`
- For each such node:
  - Gather its `member_task_ids`
  - For each task_id, call `find_groups_by_backlog_task(task_id)` (added in 190.18.3) to resolve the matching registry entries
  - For each resolved entry whose `status !== 'fixed'`: flip `status: wip → fixed`, stamp `fixed_commit` (from the `done` event's `merge_commit`) and `fixed_in_run` (current pipeline run-id)
  - For each resolved entry already `fixed`: skip silently (idempotent, no double-stamping)
- Wire as a pre-step in `.claude/skills/self-repair-pipeline/scripts/prepare_triage.ts` so it runs BEFORE classifiers are bucketed
- Idempotent: re-running for the same set of done nodes is a no-op
- Missing `graph.json` / `state.jsonl` is non-fatal (logs and continues — handles fresh installs)
- Backlog is consulted only as a fallback signal if a `done` event lacks `merge_commit`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Re-running reconciler on identical inputs leaves `registry.json` byte-equal AND emits zero log lines tagged `flipped`
- [ ] #2 Wired into prepare_triage.ts so it runs before classifiers are bucketed
- [ ] #3 Logs which registry entries flipped status this run (one line per flip, tagged `flipped`)
- [ ] #4 Missing graph.json / state.jsonl is non-fatal (logs and continues)
- [ ] #5 Tolerates a partially-written final line of state.jsonl (worker mid-append): last partial line is skipped; documented
- [ ] #6 Backlog consulted only as fallback when `done` event lacks merge_commit
- [ ] #7 Unit tests cover idempotency, missing-files, stale-event, partial-final-line, and already-fixed-entry cases
<!-- AC:END -->
