---
id: TASK-190.20.4
title: Rename group_id → novel_issue_id on curator dispatch types
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - naming
  - simplification
dependencies: []
parent_task_id: TASK-190.20
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Several internal dispatch types still use `group_id` as their identifier
field even though, post-190.19, the identifier always names a single
`novel_issue.id` (not a group of entries). The README diagram has been
updated to label this as `<novel_issue_id>` in the artifact node, but the
source files lag.

Single concept, one name. Either the identifier is a `novel_issue_id`
everywhere on the curator dispatch path, or it is a `group_id`
everywhere; mixing the two forces every reader to mentally map between
them.

## Scope

Rename `group_id → novel_issue_id` on:

- `NovelPromoteDispatch.group_id` in `scripts/curate_all.ts`
- `DispatchEntry.group_id` in `scripts/next_investigate_tasks.ts` and any
  shared dispatch-shape types
- Any references in `scripts/get_investigate_context.ts` where the field
  is consumed
- Any references in the investigator prompt
  (`.claude/agents/triage-curator-investigator.md`) where it names the
  field on the dispatched-context payload
- Tests asserting these field names

**Keep** `group_id` on the registry side (`KnownIssue.group_id`,
`ApplyResult.registry_upserts`, `RejectedMember`'s implicit parent, etc.).
Those name the registry row id, not the per-run dispatch identifier.

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 No dispatch-side type carries a `group_id` field
- [ ] #2 Registry-side types still use `group_id` exactly as before
- [ ] #3 README and SKILL.md prose uses `novel_issue_id` consistently
      when discussing the dispatch path
- [ ] #4 The investigator prompt's hydration / response schema uses
      `novel_issue_id` for the dispatch identifier
- [ ] #5 `pnpm test` is green inside the curator skill
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

Mechanical rename. Be careful at the boundary where dispatch passes into
`apply_proposals`: the `novel_issue_id` becomes a `group_id` once it
mints a registry row. Document the boundary at the call site so future
readers don't try to "fix" the inconsistency.
