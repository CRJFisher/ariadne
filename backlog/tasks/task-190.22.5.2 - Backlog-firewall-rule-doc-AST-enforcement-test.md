---
id: TASK-190.22.5.2
title: "Backlog firewall: rule doc + AST enforcement test"
status: To Do
assignee: []
created_date: "2026-06-01 15:18"
labels:
  - self-repair
  - firewall
  - enforcement
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22.5
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Make the firewall structural, not just convention — mirror the registry write-boundary contract (`.claude/rules/classifier-lifecycle.md` + `packages/skill-fs/src/registry_writers.test.ts`). `backlog/` is exclusively user-operated; the only sanctioned backlog writer is the user-invoked export adapter (190.22.5.4).

## Scope

- **Rule doc** `.claude/rules/backlog-firewall.md` (twin of classifier-lifecycle.md): a writer table stating the pipeline (`triage`, `plan`) NEVER writes `backlog/` and never calls `mcp__backlog__task_create`/`task_edit`/`task_complete`/`task_archive`/`milestone_*`/`document_create`/`document_update`; the export adapter is the sole writer, human-invoked; the human operates `backlog/` directly. Cross-reference classifier-lifecycle.md and commit-convention.md.
- **AST enforcement test** `packages/skill-fs/src/backlog_writers.test.ts` (clone of registry_writers.test.ts's AST walk over `.claude/skills/**`, `**/scripts`, `packages/**/src`): flag (a) any raw write (`writeFile`/`appendFile`/`atomic_write_file`/…) whose first arg resolves to a `backlog/`-shaped path, and (b) any reference to the mutating `mcp__backlog__*` tool names. Reuse the existing arg-resolution + negative-control machinery. `ALLOWED_BACKLOG_WRITERS = { ".claude/skills/plan/scripts/export_to_backlog.ts" }` — nothing else.

## Note

Read-only backlog access (`mcp__backlog__task_search`/`task_view`, frontmatter parse) is permitted as a dedup signal (190.22.5.3) — the test flags writes + mutator calls only, so reads pass.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `.claude/rules/backlog-firewall.md` exists with a writer table (pipeline = never; export adapter = sole human-invoked writer; human = direct), cross-referencing classifier-lifecycle.md + commit-convention.md
- [ ] #2 `packages/skill-fs/src/backlog_writers.test.ts` flags raw writes to `backlog/`-shaped paths AND references to mutating `mcp__backlog__*` tools across the skills/packages tree
- [ ] #3 `ALLOWED_BACKLOG_WRITERS` contains only the export adapter; the test has a negative control proving the scanner is not a no-op
- [ ] #4 Read-only `task_search`/`task_view`/frontmatter parse is NOT flagged
- [ ] #5 The test passes against the post-firewall tree (after 190.22.3.1); `pnpm -r test` green
<!-- AC:END -->
