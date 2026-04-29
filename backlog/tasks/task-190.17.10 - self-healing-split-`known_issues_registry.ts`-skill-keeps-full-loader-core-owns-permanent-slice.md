---
id: TASK-190.17.10
title: >-
  self-healing: split `known_issues_registry.ts` (skill keeps full loader; core
  owns permanent slice)
status: Done
assignee: []
created_date: "2026-04-28 19:17"
labels:
  - self-repair
  - skill-retarget
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

The skill's `src/known_issues_registry.ts` today loads the full registry and validates it. After classification moves into core, two loaders coexist:

- **Skill loader** (full registry, validates `permanent + wip + fixed`, includes `kind: none` placeholders) — used by the self-healing pipeline.
- **Core loader** (`packages/core/src/classify_entry_points/registry_loader.ts`, introduced in `.6`) — loads only `permanent + classifier.kind != "none"` from the bundled `registry.permanent.json`.

This sub-sub-task formalizes the split.

## Files

- KEEP: `.claude/skills/self-repair-pipeline/src/known_issues_registry.ts` — drops core-overlap responsibilities; remains as the canonical full-registry loader. `compiled_pattern` injection (regex precompile at load time) stays here since it's runtime-only.
- KEEP: `.claude/skills/self-repair-pipeline/src/known_issues_registry.test.ts` — focuses on full-registry validation including `wip` and `kind: none` paths.
- ENSURE: `packages/core/src/classify_entry_points/registry_loader.ts` (added in `.6`) does not duplicate validation already covered in the skill loader; instead, it trusts the slice generator's invariants.
- ADD `schema_version: 1` field to `registry.json` (currently a bare `KnownIssue[]`) — bump on future shape changes. Skill loader rejects mismatched versions; core loader's slice always carries the matching version because the sync script copies it.

## Constraint

Both loaders share the `KnownIssue` type from `@ariadnejs/types` (graduated in `.3`). The split is about _what data each one accepts_, not type duplication.

## Verification

- `pnpm test` passes in `.claude/skills/self-repair-pipeline/` and `packages/core/`.
- Skill's full-registry loader + tests still cover the `wip` + `kind: none` cases.
- Core's permanent-slice loader rejects a synthetic non-permanent entry (defense in depth).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Skill known_issues_registry.ts retains full-registry loading + compiled_pattern injection
- [x] #2 Core registry_loader.ts loads only permanent + non-none rules from bundled JSON
- [x] #3 Both loaders import the shared KnownIssue type from @ariadnejs/types
- [x] #4 schema_version: 1 added to registry.json + both loaders validate it
- [x] #5 Skill loader rejects mismatched schema_version; core loader trusts slice generator
- [x] #6 Skill tests cover wip and kind: none paths
- [x] #7 Core tests cover permanent-only loading and rejection of non-permanent synthetic entries
- [x] #8 pnpm test passes in skill and packages/core
<!-- AC:END -->
