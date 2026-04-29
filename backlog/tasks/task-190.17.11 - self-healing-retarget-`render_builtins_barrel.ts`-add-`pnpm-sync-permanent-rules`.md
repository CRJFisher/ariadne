---
id: TASK-190.17.11
title: >-
  self-healing: retarget `render_builtins_barrel.ts`; add `pnpm
  sync-permanent-rules`
status: Done
assignee: []
created_date: "2026-04-28 19:18"
updated_date: "2026-04-28 21:27"
labels:
  - self-repair
  - skill-retarget
  - build
dependencies:
  - TASK-190.17.5
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

After `.5` moves the `auto_classify/builtins/` directory into core, the renderer that emits the barrel (`render_builtins_barrel.ts`) needs a new output path. Add a single `pnpm sync-permanent-rules` script that wraps both the barrel regeneration and the permanent-slice JSON regeneration into one command — invoked pre-commit on registry edits and in CI.

## Builtins regen ownership

This task is the **authoritative owner of the builtins regen contract** for the migration. `pnpm sync-permanent-rules` is the single command that:

1. Generates `packages/core/src/classify_entry_points/registry.permanent.json` from the full skill registry.
2. Regenerates `packages/core/src/classify_entry_points/builtins/index.ts` via `render_builtins_barrel`.

Other tasks reference this contract:

- `.5` (orchestrator move) ships a one-time bulk codemod of `check_*.ts` imports as part of the move; it does NOT add an ongoing regen step.
- `.12` (renderer update) modifies `render_classifier.ts` to emit the new `EnrichedEntryPoint` import string and triggers a one-time bulk re-render of every `check_*.ts`. Once those files are re-rendered, this task's `pnpm sync-permanent-rules` keeps them in sync going forward.

If a future renderer change drifts (a regression), CI catches it via the `git diff --exit-code` step in this task. `.5` and `.12` defer to this task's CI gate rather than running their own.

## Renderer retarget

`.claude/skills/self-repair-pipeline/src/auto_classify/render_builtins_barrel.ts`:

- Output path: `packages/core/src/classify_entry_points/builtins/index.ts` (was: `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/index.ts`).
- Emitted import header: `import type { EnrichedEntryPoint } from "@ariadnejs/types"` (was: `import type { EnrichedFunctionEntry } from "../../entry_point_types.js"`).
- Source data: full skill registry filter `status: "permanent" && classifier.kind === "builtin"`. (`predicate` and `none` rules don't need a barrel entry.)

## Permanent-slice generator

ADD: `.claude/skills/self-repair-pipeline/scripts/sync_permanent_rules.ts` — generates `packages/core/src/classify_entry_points/registry.permanent.json` from `.claude/skills/self-repair-pipeline/known_issues/registry.json`, filtering `status === "permanent" && classifier.kind !== "none"`. Preserves field order for stable diffs.

## Build wrapper

ADD: `pnpm sync-permanent-rules` script in the **root** `package.json` (or a workspace-level command). Runs:

1. `tsx .claude/skills/self-repair-pipeline/scripts/sync_permanent_rules.ts`
2. `tsx .claude/skills/self-repair-pipeline/src/auto_classify/render_builtins_barrel.ts` (or whatever the new entry-point command is)

## CI integration

Add a CI step that runs `pnpm sync-permanent-rules && git diff --exit-code packages/core/src/classify_entry_points/`. If the slice or barrel are out of date with the registry, CI fails. This is the same pattern used for any generated source.

## Pre-commit hook (optional)

If `.claude/hooks/` already runs hooks on registry edits, wire a hook that invokes `pnpm sync-permanent-rules` when `known_issues/registry.json` is modified.

## Verification

- `pnpm sync-permanent-rules` produces `packages/core/src/classify_entry_points/registry.permanent.json` and barrel `packages/core/src/classify_entry_points/builtins/index.ts`.
- `git diff --exit-code` is clean immediately after running.
- `pnpm test` passes in `packages/core/` (regenerated builtins compile).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 render_builtins_barrel.ts emits to packages/core/src/classify_entry_points/builtins/index.ts
- [x] #2 Emitted import header uses @ariadnejs/types and EnrichedEntryPoint
- [x] #3 scripts/sync_permanent_rules.ts generates registry.permanent.json from full registry filtering status==permanent && classifier.kind!=none
- [x] #4 sync_permanent_rules preserves field order for stable diffs
- [x] #5 pnpm sync-permanent-rules root script wraps both generators in one command
- [x] #6 CI step runs pnpm sync-permanent-rules then git diff --exit-code packages/core/src/classify_entry_points/ to catch drift
- [x] #7 Generated registry.permanent.json and barrel build cleanly via tsc
- [x] #8 pnpm test passes in packages/core/ with regenerated builtins
- [x] #9 This task documented as authoritative owner of the builtins regen contract; .5 and .12 reference rather than duplicate the build steps
<!-- AC:END -->
