---
id: TASK-190.22.3.1
title: "Firewall: retarget/remove the pipeline's backlog-writing machinery"
status: To Do
assignee: []
created_date: "2026-06-01 15:18"
labels:
  - self-repair
  - firewall
  - plan-skill
dependencies:
  - TASK-190.22.2.1
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22.3
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

`backlog/` becomes exclusively user-operated. As part of stripping `plan`'s code-mutating machinery (Phase 3), remove every path by which the pipeline writes the user's backlog — the pipeline will instead write its own task-DB (impl in 190.22.5.1; engine wiring in 190.22.5.3). The only sanctioned backlog writer is the user-invoked export adapter (190.22.5.4).

## Scope

- **Retarget the pure row-builders, drop the MCP feed.** `triage-curator/src/propose/propose_backlog_tasks.ts` — keep `render_task_title`/`render_task_body`/`render_task_labels` (reused by the engine + export adapter), but they become feedstock for `PlanTask` records, not for `mcp__backlog__task_create`. Strip the `mcp__backlog__*` references from docstrings.
- **Remove the backlog-coupling.** Delete `scripts/link_ariadne_bug_tasks.ts` + the `link_ariadne_bug_tasks` path in `src/apply/apply_proposals.ts` + the `created_task_ids.json` sidecar (`src/store/paths.ts` `created_task_ids_path`). If a registry backlink is still wanted, it points at the task-DB id, not a `TASK-<N>` backlog id. (Most of `src/apply/*` is already being stripped/parked by Phase 3; this ensures the backlog-specific pieces go with it.)
- **SKILL.md** — remove `mcp__backlog__task_create`/`task_edit` from the `plan` `allowed-tools`; rewrite the "File backlog tasks" step (curator SKILL.md:151-241) as "write proposals to the task-DB"; drop the `created_task_ids.json` handshake. Keep `mcp__backlog__task_search`/`task_view` ONLY for read-only dedup (see 190.22.5.3).
- **Types** — drop `AriadneBugTaskToCreate`/`SignalLibraryGapTaskToCreate`/`TaskProposal`/`TaskUpdateProposal` + `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` (backlog-specific); their role is taken by `PlanTask` (190.22.2.1). Update `get_investigate_context.ts:145` + `types.ts:242` (`existing_task_id`) to mean "existing DB task".

## Verification

`grep` finds no `mcp__backlog__task_create`/`task_edit` and no writes to `backlog/` anywhere under the `plan` skill; build/tests green. (The structural AST enforcement is added in 190.22.5.2.)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 No `mcp__backlog__task_create`/`task_edit`/`task_complete`/`task_archive` calls or `backlog/`-path writes remain anywhere under the `plan` skill (src, scripts, SKILL.md `allowed-tools`)
- [ ] #2 `link_ariadne_bug_tasks` (script + apply_proposals path) and the `created_task_ids.json` sidecar are deleted; any registry backlink points at the task-DB id, not a `TASK-<N>`
- [ ] #3 The pure row-builders (`render_task_*`) are retained as feedstock for `PlanTask` records; backlog-specific proposal types + `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` are removed
- [ ] #4 SKILL.md Step-4 rewritten to 'write proposals to the task-DB'; only read-only `task_search`/`task_view` may remain (for dedup)
- [ ] #5 `pnpm -r build && pnpm -r test` green; no dangling imports
<!-- AC:END -->
