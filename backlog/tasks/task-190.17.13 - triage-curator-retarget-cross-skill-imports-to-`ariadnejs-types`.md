---
id: TASK-190.17.13
title: "triage-curator: retarget cross-skill imports to `@ariadnejs/types`"
status: To Do
assignee: []
created_date: "2026-04-28 19:19"
updated_date: "2026-04-28 19:38"
labels:
  - triage-curator
  - skill-retarget
dependencies:
  - TASK-190.17.2
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

The triage-curator imports `KnownIssue*` and `ClassifierSpec` types from the self-repair-pipeline skill via relative paths (`../../self-repair-pipeline/...`). After `.3` graduates these types to `@ariadnejs/types`, the curator should import directly from there — eliminating cross-skill coupling.

## Sites to retarget

- `.claude/skills/triage-curator/src/promote_novel_groups.ts:17-20` — `KnownIssue`, `KnownIssueLanguage`
- `.claude/skills/triage-curator/src/propose_backlog_tasks.ts:14-17` — `KnownIssue`, `ClassifierSpec`
- `.claude/skills/triage-curator/src/promote_novel_groups.test.ts:3` — same
- `.claude/skills/triage-curator/src/propose_backlog_tasks.test.ts:3` — same
- `.claude/skills/triage-curator/scripts/finalize_run.ts:29-31` — `KnownIssue`, plus `render_unsupported_features` (skill-internal — keep as-is) and `render_builtins_barrel` (covered by `.11`'s output path change)
- `.claude/skills/triage-curator/scripts/promote_novel_groups.ts:18-20`, `scripts/propose_backlog_tasks.ts:22-24`
- `.claude/skills/triage-curator/src/types.ts:1,38-46,142` — collapse the duplicated `KnownIssue*` "mirrors" comments. Line 1 is the "mirrors self-repair-pipeline canonical output" header; lines 38-46 carry the `KnownIssueStatus` / "Closed enum mirroring" comment / `KnownIssueLanguage` type; line 142 is the "Mirrors `ClassifierSpec`" comment. Either re-export from `@ariadnejs/types` or remove the local copies entirely.
- `.claude/skills/triage-curator/src/paths.ts:14-26` — `get_registry_file_path()` resolves the skill registry; this stays. Add `get_permanent_slice_path()` sibling pointing at `packages/core/src/classify_entry_points/registry.permanent.json` (used by `.14`).

## Constraint

The triage-curator's _own_ types (`InvestigateResponse`, `QaResponse`, `CuratorRunSummary`, etc.) stay local. Only types that are properly shared with self-repair-pipeline graduate.

## Verification

- `pnpm test` passes in `.claude/skills/triage-curator/`.
- `grep -rn "from.*self-repair-pipeline" .claude/skills/triage-curator` returns no hits except for paths-only references (e.g. `paths.ts` resolving the skill registry file).
- `pnpm build` clean across both skills.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 promote_novel_groups.ts cross-skill imports retargeted to @ariadnejs/types
- [ ] #2 propose_backlog_tasks.ts cross-skill imports retargeted to @ariadnejs/types
- [ ] #3 promote_novel_groups.test.ts and propose_backlog_tasks.test.ts imports retargeted
- [ ] #4 scripts/finalize_run.ts, scripts/promote_novel_groups.ts, scripts/propose_backlog_tasks.ts cross-skill imports retargeted
- [ ] #5 src/types.ts mirror comments collapsed; either re-exports or local copies removed
- [ ] #6 paths.ts gains get_permanent_slice_path() sibling resolving to core's slice
- [ ] #7 grep returns no remaining 'from .\*self-repair-pipeline' type imports in triage-curator (paths-only references allowed)
- [ ] #8 Triage-curator's own InvestigateResponse, QaResponse, CuratorRunSummary types stay local
- [ ] #9 pnpm test passes in .claude/skills/triage-curator/
- [ ] #10 pnpm build clean across both skills
<!-- AC:END -->
