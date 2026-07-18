---
id: TASK-362.12
title: Add the stage-boundary Stop hook and its paired stage-boundaries rule
status: Done
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

- [x] #1 stage_boundary_stop.ts blocks value-imports from a lower to a higher pipeline stage and registries/**->call_resolution/**; import type is exempt
- [x] #2 each changed index.ts may only re-export its own subtree; a zero-export zero-importer barrel is flagged dead
- [x] #3 test uses the four real review violations as fixtures; ships warn-only until 362.6, then blocks
- [x] #4 .claude/rules/stage-boundaries.md (paths: packages/core/src/\*\*) restates the stage order and barrel contract
<!-- AC:END -->

## Implementation Notes

## High-level summary

The core pipeline's dependency direction — `index_single_file` (1) → `resolve_references` (2) → `trace_call_graph` / `classify_entry_points` (3), orchestrated by `project/` — is a contract nothing previously enforced. This task closes that gap at the enforce layer with a Stop hook over the two deterministic invariants (value-import direction and barrel subtree ownership), paired with a path-scoped rule that states the contract at write time, with zero always-on context.

The invariant logic lives in `.claude/hooks/stage_boundary.ts` as pure functions over `{ path, content }` records; the thin `.claude/hooks/stage_boundary_stop.ts` wrapper supplies git state (`utils.get_changed_files`) and the filesystem, following the repo's logic-module + `_stop.ts` hook convention. Imports are parsed with the TypeScript compiler API rather than regexes so comments, template literals, multi-line statements, and inline `{ type X }` specifiers classify exactly — a blocking hook cannot afford text-match false positives. `STAGE_ORDER` is the source of truth; `project` is an Infinity sentinel, which makes "project imports anything" and "nothing imports project" the same comparison. The `registries → call_resolution` ban is a dedicated same-stage rule.

The hook ships blocking, not warn-only: 362.6 is merged, and a whole-tree sweep of all 312 core source files returns zero violations. The two back-edges 362.6 documented as out-of-scope watch items (`trace_call_graph` → `project/detect_test_file`, `classify_entry_points` → `project/file_loading`) are pinned in `GRANDFATHERED_EDGES` — exact `file → specifier` pairs, so any new edge still blocks — and each entry retires when its shared primitive is lifted out of `project/`. Of the four review violations used as test fixtures, two block (the `project/index.ts` barrel escape, `registries/type.ts` → `call_resolution`) and two are asserted as allowed — they were relocation judgment calls, outside the deterministic rule (later-stage → earlier-stage; project → any stage), and the tests document that precision boundary.

Navigate: `stage_boundary.ts` owns the contract, `stage_boundary_stop.ts` owns the plumbing, `stage_boundary.test.ts` is the behavioral spec (41 cases), `.claude/rules/stage-boundaries.md` is the agent-facing statement, and CI runs the test via the config-less root vitest step in `.github/workflows/test.yml`. Known scope edges, deliberate: dynamic `import()` and two-step barrel evasion (`import` + local `export`) are unchecked; the hook scans changed files only (tree-wide regressions surface when a file is next edited); on git failure it fails open, matching sibling hooks.
