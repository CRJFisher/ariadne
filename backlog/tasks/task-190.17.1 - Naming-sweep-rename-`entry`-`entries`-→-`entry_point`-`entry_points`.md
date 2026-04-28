---
id: TASK-190.17.1
title: 'Naming sweep: rename `entry`/`entries` → `entry_point`/`entry_points`'
status: To Do
assignee: []
created_date: '2026-04-28 19:12'
updated_date: '2026-04-28 19:32'
labels:
  - naming-hygiene
  - self-repair
dependencies: []
parent_task_id: TASK-190.17
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Scope

Codebase-wide rename of the `entry` / `entries` shorthand wherever it refers to an entry point. Done **before** structural code moves so import-path renames in later sub-sub-tasks are mechanical, not naming-and-moving in one step.

## Renames

Use `git mv` for files/folders to preserve history. Update all import sites and call sites.

| Current | Renamed |
|---|---|
| Skill type `EnrichedFunctionEntry` (in `.claude/skills/self-repair-pipeline/src/entry_point_types.ts`) | `EnrichedEntryPoint` |
| Skill type `AutoClassifiedEntry` (in `.claude/skills/self-repair-pipeline/src/auto_classify/types.ts`) | `AutoClassifiedEntryPoint` |
| Any `entries: AutoClassifiedEntry[]` parameter / variable | `entry_points: AutoClassifiedEntryPoint[]` |
| Any internal `entry` variable holding an entry-point record | `entry_point` |
| Skill scripts referencing renamed identifiers (`prepare_triage.ts`, `build_triage_entries.ts`, `build_finalization_output.ts`, `triage_state_types.ts`, `extract_entry_points.ts`, all 60+ `auto_classify/builtins/check_*.ts`) | update imports + identifiers |
| `.claude/skills/triage-curator/` cross-skill imports referencing the old names | update |
| All test files (`*.test.ts`) referencing the old names (~5 self-repair test files, ~24 mentions; 1 triage-curator test file with literal-string assertions at `src/render_classifier.test.ts:51,54`) | update |

## Constraint

Do **not** rename `EntryPointDiagnostics` (already correct), `EntryPointClassification` (introduced in `.6`), or any field already using `entry_point*`. Only the `entry`/`entries` shorthand is in scope.

## Verification

- `pnpm test` passes in `.claude/skills/self-repair-pipeline/`, `.claude/skills/triage-curator/`, and all `packages/`.
- `grep -rn 'EnrichedFunctionEntry\|AutoClassifiedEntry' .claude/skills packages` returns no hits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 EnrichedFunctionEntry renamed to EnrichedEntryPoint everywhere
- [ ] #2 AutoClassifiedEntry renamed to AutoClassifiedEntryPoint everywhere
- [ ] #3 All `entries: AutoClassifiedEntry[]` parameters and variables renamed to `entry_points: AutoClassifiedEntryPoint[]`
- [ ] #4 All internal `entry` variables holding entry-point records renamed to `entry_point`
- [ ] #5 Triage-curator render_classifier.test.ts:51,54 literal-string assertions updated to match new emitted import
- [ ] #6 All tests pass in self-repair-pipeline, triage-curator, packages/core, packages/mcp, packages/types
- [ ] #7 grep for the old names returns zero hits across .claude/skills/ and packages/
- [ ] #8 Skill tests src/diff_runs.test.ts and src/build_finalization_output.test.ts updated for EnrichedFunctionEntry → EnrichedEntryPoint and AutoClassifiedEntry → AutoClassifiedEntryPoint renames
<!-- AC:END -->
