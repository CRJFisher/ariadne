---
id: TASK-190.18.5
title: '`diff_runs.ts --annotate-fixes` labels expected FP↔TP flips'
status: To Do
assignee: []
created_date: '2026-04-29 10:31'
labels:
  - self-repair
  - fix-sequencer
  - self-repair-pipeline-extension
  - loop-closure
dependencies:
  - TASK-190.18.3
parent_task_id: TASK-190.18
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Once the registry tracks `fixed_commit`, run-diff output should distinguish *expected* fix-induced FP→TP transitions from genuine regressions. Without this, a successful fix shipping reads as a false alarm in cross-run comparisons.

## Scope

- File: `.claude/skills/self-repair-pipeline/scripts/diff_runs.ts`
- Add `--annotate-fixes` flag (opt-in; default off)
- For each transitioned entry, look up the registry's `fixed_commit`
- If the previous run is at a commit BEFORE `fixed_commit` and the new run is at/after, label the transition as `expected: registry entry <group_id> fixed at <commit>`
- Otherwise leave the transition unannotated

## Out of scope

- Generating registry entries (covered by 190.18.3, 190.18.4)
- Replacing the existing diff output structure
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Flag opt-in (default off)
- [ ] #2 Annotates each transition with `expected: registry entry X fixed at <commit>` when applicable
- [ ] #3 Unaffected output when the flag is absent
- [ ] #4 Unit tests cover (a) transition with matching fixed_commit, (b) transition without registry link, (c) transition that predates the fix
<!-- AC:END -->
