---
id: TASK-362.12
title: Add the stage-boundary Stop hook and its paired stage-boundaries rule
status: To Do
assignee: []
created_date: "2026-07-05 11:39"
labels:
  - information-architecture
  - claude-customisation
  - enforce
dependencies:
  - TASK-362.6
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). Enforce the two deterministic barrel/boundary invariants with a new Stop hook (**enforce-layer**), and state the contract in a paired path-scoped rule (**encourage-layer**) so agents write correct imports before the hook fires. Zero always-on context.

### 1. Hook

Create `.claude/hooks/stage_boundary_stop.ts` and wire it into the existing Stop array in `.claude/settings.json`.

- Early-exit 0 unless `utils.get_changed_files` reports a path under `packages/core/src`.
- Run a text/AST pass over CHANGED `.ts` files' import/export-from statements only (no `load_project`/call-graph pass — must stay text-level; `detect_dead_code` already carries the heavy analysis).
- **Barrel check:** for each changed `**/index.ts`, block any `export ... from` whose resolved relative target lies outside the barrel's own directory subtree (catches `project/index.ts` re-exporting `resolve_references` registries); flag an `index.ts` with zero export statements and zero importers as dead — delete it.
- **Stage check:** hardcoded `STAGE_ORDER` keyed on the top-level dir under `packages/core/src` (`index_single_file`=1, `resolve_references`=2, `trace_call_graph`=3, `classify_entry_points`=3, `project`=orchestrator/exempt-as-importer). Block any VALUE import from a lower stage to a strictly higher stage, and `registries/**` importing `call_resolution/**`. `import type` and inline `import { type X }` are exempt. Only resolve relative specifiers within `packages/core/src` (cross-package `@ariadnejs/*` imports are out of scope). Block reason names `file:line` and the offending specifier.
- Co-locate `stage_boundary_stop.test.ts` using the review's four real violations as fixtures: `project/index.ts` re-exports; `registries/type.ts` → `call_resolution/method_lookup`; `call_resolution/call_resolver.ts` → `index_single_file/scopes`; `project/import_graph.ts` → `resolve_references/import_resolution`.
- Ship in **warn-only** mode (additionalContext instead of `decision:block`) until 362.6 clears those violations, then flip to block.

### 2. Rule

Create `.claude/rules/stage-boundaries.md` (`paths: packages/core/src/**`), ~15 canonical present-tense lines: the stage order; the value-import direction rule (`project/` may import any stage; no stage imports `project/` or a later stage; `registries` never import `call_resolution`; `import type` exempt); and the barrel contract (an `index.ts` re-exports only its own folder's surface; a barrel with no exports and no importers is deleted). The hook's `STAGE_ORDER` is the source of truth; the rule restates it. Fills the audit's "no dependency-direction rule" gap.

**Sequencing:** blocking mode depends on 362.6 (align stage boundaries and barrels) landing; ship warn-only before that.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 stage_boundary_stop.ts blocks value-imports from a lower to a higher pipeline stage and registries/**->call_resolution/**; import type is exempt
- [ ] #2 each changed index.ts may only re-export its own subtree; a zero-export zero-importer barrel is flagged dead
- [ ] #3 test uses the four real review violations as fixtures; ships warn-only until 362.6, then blocks
- [ ] #4 .claude/rules/stage-boundaries.md (paths: packages/core/src/\*\*) restates the stage order and barrel contract
<!-- AC:END -->
