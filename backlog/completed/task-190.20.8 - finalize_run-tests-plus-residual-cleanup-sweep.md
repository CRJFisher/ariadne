---
id: TASK-190.20.8
title: >-
  Add finalize_run.ts test coverage + residual doc / cast / naming
  cleanup sweep
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - tests
  - docs
  - cleanup
dependencies:
  - TASK-190.20.1
  - TASK-190.20.2
  - TASK-190.20.3
  - TASK-190.20.4
  - TASK-190.20.5
parent_task_id: TASK-190.20
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

This is the final pass under 190.20: add the missing test coverage for
`finalize_run.ts` and sweep up the residual prose / type / cast items
that prior sub-tasks did not explicitly touch.

Lands last because most of the residual items are easier to address once
the structural sub-tasks (.1–.5) have collapsed the surface area.

## Scope

### 1. `finalize_run.ts` test coverage

The orchestration body is currently untested. Extract `main()` into a
pure-ish function (`finalize_run({run_path, dry_run, ...}): Promise<...>`)
that takes its filesystem dependencies as arguments where possible.
Cover, at minimum:

- The `is_curated` sentinel guard (exit code 2)
- The `validate_run_coherence` failure path (exit code 3)
- The orphan-cleanup safety check (`refused_orphan_paths` for paths that
  escape the builtins dir or have non-`check_*.ts` basenames)
- The AST-check of authored files (`ast_failures` for syntactically bad
  output)
- Replay safety after partial failure (depends on 190.20.5 landing)

### 2. Remaining schema-cast holdouts

After 190.20.1 deletes `get_qa_context.ts`, the only remaining bare cast
of `as TriageResultsFile` is in
`scripts/find_promotion_candidates.ts:60` (uses `Partial<TriageResultsFile>`).
Route through `read_v4_triage_results` (or its `Partial`-tolerant sibling).

### 3. Stale prose + comment sweep

Items remaining after the 190.19 cleanup commit:

- SKILL.md line ~11–15: "puller floats drift-flagged wip rules to the
  front of the queue" wording is overstated — drift now flows through
  finalize's absorb path, not the puller. Rephrase.
- SKILL.md lines ~325, ~340: "false-positive group" / "false-positive
  pressure" — rephrase to `novel_issue` framing.
- `meta.json:4` skill `description` field still uses the pre-190.19
  framing ("audits auto-classified false-positive groups, investigates
  residuals"). Rewrite to match v4 reality.
- `src/validate_investigate_responses.ts:70` — drop the trailing "or
  members on a promoted QA-broken classifier" clause (after 190.20.1 the
  dispatch source is exclusively a promote-novel novel issue).
- Verify no stale "rough-aggregator" / "false-positive group" /
  "residuals" tokens remain in source comments after .1–.5 land.

### 4. ApplyOptions.session_logs dead-field cleanup

If 190.20.1 (QA-wave deletion) does not naturally remove the
`session_logs?: InvestigatorSessionLog[]` field on `ApplyOptions`
(`src/apply_proposals.ts:190` — passed by `finalize_run.ts:313` but
never read inside `apply_proposals`), delete it here.

### 5. `find_promotion_candidates` and operator-script docs

Verify that on-demand scripts (`generate_impact_report`,
`find_promotion_candidates`, `promote_novel_groups`,
`propose_backlog_tasks`) all appear as `flows[]` entries in
`meta.json` with `kind: "user_invocation"` (currently only one such
entry exists). Add the missing flow entries.

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 `.claude/skills/triage-curator/scripts/finalize_run.test.ts`
      exists and exercises the five failure paths listed in Scope §1
- [ ] #2 No `as TriageResultsFile` cast remains in the curator's
      `scripts/` directory
- [ ] #3 `grep -rn "rough-aggregator\|false-positive group\|false-positive groups\|residual group" .claude/skills/triage-curator/` returns no hits in source or canonical docs
- [ ] #4 `ApplyOptions.session_logs` is removed (or documented as
      load-bearing with a test)
- [ ] #5 `meta.json` `flows[]` covers every operator-invokable script
      documented in SKILL.md
- [ ] #6 `pnpm test` is green; `npx tsc --noEmit` is clean
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

Lands last because some of these residuals will be incidentally cleaned
by .1–.5. Pick them up as a final sweep so this task's diff is small.
