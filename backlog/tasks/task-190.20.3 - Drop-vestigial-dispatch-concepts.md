---
id: TASK-190.20.3
title: >-
  Drop vestigial dispatch concepts (mode singleton, drift-priority no-op,
  RunDispatch echo, fixed-resurfacing bookkeeping)
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - simplification
  - dead-code
dependencies: []
parent_task_id: TASK-190.20
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Four small concepts on the curator's dispatch surface are now vestigial
after 190.19's collapse to a single per-issue verdict shape. Each is
small in isolation, but together they make the dispatch types and the
puller noticeably more complex than the actual logic warrants.

## Scope

### 1. `InvestigatorSessionLog.mode` is a singleton

`mode: "promote-novel"` is the only legal value (post-190.19.7), and the
session-log parser at `src/session_log.ts:46` rejects anything else. The
field carries no information.

- Drop the field from the `InvestigatorSessionLog` interface in
  `src/types.ts`
- Drop the corresponding write site in `scripts/get_investigate_context.ts`
- Drop the parser check in `src/session_log.ts:46`
- Drop the field from the investigator prompt's session-log schema in
  `.claude/agents/triage-curator-investigator.md`
- Update tests that assert the field

### 2. `sort_by_drift_priority` is a constant function

`scripts/next_investigate_tasks.ts` only ever processes
`novel_promote_dispatches`, whose `group_id` is a novel-issue id with no
registry row by construction (the `wip` / `permanent` / `fixed` arms of
`classify_novel_issues` short-circuit before dispatch). The registry
lookup inside `sort_by_drift_priority` therefore always misses, and the
priority is always 1.

- Delete the function + its registry read
- Delete the drift-priority paragraph in `SKILL.md` Step 2 (or whatever
  step now hosts it) and the matching prose in the README's Phase 3
  description
- Reduce the puller to: dedupe by `output_path`, filter not-done, slice
  to `limit`

### 3. `RunDispatch.classifier_regressions` is a count-only echo

`scripts/curate_all.ts` builds `ClassifierRegressionDispatch[]` carrying
`{rule_id, flagged_entry_count}` per flag. `finalize_run.ts` re-reads the
full `triage.classifier_regressions` array from the source artefact and
does not use the count-only echo. Two paths into finalize for the same
data.

- Drop the field from `RunDispatch` in `scripts/curate_all.ts`
- Update the prose mentions in SKILL.md (Step 1 row) and the README's
  Phase 1 commentary
- Adjust any test that asserts the field

### 4. `fixed_novel_issue_resurfacings` is dead bookkeeping

`classify_novel_issues` produces a `fixed_novel_issue_resurfacings`
partition; nothing reads it, no commit message renders it, no operator
surface points at it. Either wire it into the commit-message body (as a
human-review surface for "a fixed rule resurfaced") or delete the
partition entirely.

- Decision: wire it OR delete it. Document the choice in the task's
  Implementation Notes.

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 `InvestigatorSessionLog.mode` no longer exists; tests updated
- [ ] #2 `sort_by_drift_priority` is removed; puller reads no registry
      data
- [ ] #3 `RunDispatch.classifier_regressions` is removed; finalize keeps
      reading from `triage.classifier_regressions` directly
- [ ] #4 `fixed_novel_issue_resurfacings` either appears in the commit
      message body or is removed from the data shape
- [ ] #5 `pnpm test` is green inside the curator skill
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

These four items are independent but small enough that a single PR is
cheaper than four. Order: #1 (mode field) and #3 (RunDispatch echo) are
pure type/field deletions. #2 (drift-priority) and #4
(fixed_resurfacings) need a small operational decision before subtracting.
