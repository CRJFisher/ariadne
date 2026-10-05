---
id: TASK-190.20.3
title: >-
  Drop vestigial dispatch concepts (mode singleton, drift-priority no-op,
  RunDispatch echo, fixed-resurfacing bookkeeping)
status: Done
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

- [x] #1 `InvestigatorSessionLog.mode` no longer exists; tests updated
- [x] #2 `sort_by_drift_priority` is removed; puller reads no registry
      data
- [x] #3 `RunDispatch.classifier_regressions` is removed; finalize keeps
      reading from `triage.classifier_regressions` directly
- [x] #4 `fixed_novel_issue_resurfacings` either appears in the commit
      message body or is removed from the data shape
- [x] #5 `pnpm test` is green inside the curator skill
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

These four items are independent but small enough that a single PR is
cheaper than four. Order: #1 (mode field) and #3 (RunDispatch echo) are
pure type/field deletions. #2 (drift-priority) and #4
(fixed_resurfacings) need a small operational decision before subtracting.

### Resolution (2026-05-25)

All four items landed as part of Wave A.

**#1 — `InvestigatorSessionLog.mode` singleton dropped.** Field gone from
`src/types.ts`, parser check removed from `src/session_log.ts`,
`mode: "promote-novel" as const` removed from `scripts/get_investigate_context.ts`
output, `mode` mention removed from `.claude/agents/triage-curator-investigator.md`
(prompt + JSON schema). `src/session_log.test.ts` updated (dropped the
`mode: "promote-novel"` field from the base fixture and the "rejects unknown
mode" test); `src/validate_investigate_responses.test.ts` updated (two
fixtures dropped the field).

**#2 — `sort_by_drift_priority` dropped.** The function and its registry-read
helpers removed from `scripts/next_investigate_tasks.ts`. The puller no
longer loads `registry.json` at all (the `parse_known_issues_registry_json`
and `get_registry_file_path` imports are gone). The reduced loop is:
dedupe-by-`output_path` → filter `is_done` → `slice(0, limit)`.
`scripts/next_investigate_tasks.test.ts` rewritten to cover the new
contract (3 tests: shape, dedupe-by-output, distinct outputs preserved).
Drift-priority prose removed from `SKILL.md` and the `README.md` mermaid
puller label (`puller · dedup + slice`).

**#3 — `RunDispatch.classifier_regressions` count-only echo dropped.** The
`ClassifierRegressionDispatch` type and the `RunDispatch.classifier_regressions`
field are gone from `scripts/curate_all.ts`. `finalize_run.ts` still reads
the per-rule aggregate straight from `triage.classifier_regressions` on the
v4 published artifact (no per-run echo needed). SKILL.md Step 1 prose updated.

**#4 — `fixed_novel_issue_resurfacings` — KEPT (surfaced to operator via
`curate_all` stdout).** The partition is emitted as part of the per-run
`RunDispatch` JSON that `curate_all` prints; operators see it as part of the
sweep plan. The previous claim that "nothing reads it" was inaccurate — the
human reading `curate_all`'s output is the reader. Documentation updated in
`scripts/curate_all.ts`, `src/apply_proposals.ts` (cross-reference comment),
and `SKILL.md` Step 1 to name this consumer explicitly.
