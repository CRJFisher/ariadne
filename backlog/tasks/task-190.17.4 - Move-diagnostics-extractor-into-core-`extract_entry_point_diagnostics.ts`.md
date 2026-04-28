---
id: TASK-190.17.4
title: Move diagnostics extractor into core (`extract_entry_point_diagnostics.ts`)
status: To Do
assignee: []
created_date: "2026-04-28 19:14"
labels:
  - self-repair
  - core-refactor
dependencies:
  - TASK-190.17.3
parent_task_id: TASK-190.17
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Move per-entry-point diagnostics extraction (grep call sites, decorator scrape, definition features, resolution-failure reason) from the skill into the core package. Switch the file-I/O source from raw filesystem reads to `Project.file_contents` so the diagnostics see the same content the resolver saw (no TOCTOU drift; works for in-memory edits via `Project.update_file`).

## Move

`git mv .claude/skills/self-repair-pipeline/src/extract_entry_points.ts packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts`

Plus its colocated test, helpers (`build_constructor_to_class_name_map`, `attach_unindexed_test_grep_hits`, `collect_unindexed_test_files`, `UNINDEXED_TEST_DIR_SEGMENTS`).

## I/O source switch

Today the extractor takes a `source_files: ReadonlyMap<string, string>` parameter and reads from disk in the calling script. Post-move, it takes a `Project` instance and calls `project.get_file_contents()` (read-only accessor — add it to `packages/core/src/project/project.ts:124` if not already exposed).

## Constraint — `grep_call_sites_unindexed_tests` stays opt-in

The unindexed-test grep is the only diagnostic that touches FS outside the indexed source set. Keep it behind an explicit option (`{ include_unindexed_tests: true }`) — do not run on every `enrich_call_graph` call.

## Skill side

Skill keeps a thin re-export until `.8` retargets `prepare_triage.ts`. The skill's `extract_entry_points.test.ts` either moves to core or is deleted in favor of new core-side coverage.

## Verification

- `pnpm test` in `packages/core/` passes including new tests for `extract_entry_point_diagnostics`.
- The grep-index optimization (one O(source bytes) pass, then O(1) lookups) is preserved — no quadratic regression.
- Skill scripts (`detect_entrypoints.ts`, `prepare_triage.ts`) still build and pass tests using the re-export.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 extract_entry_points.ts moved via git mv to packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts
- [ ] #2 Helpers attach_unindexed_test_grep_hits, collect_unindexed_test_files, UNINDEXED_TEST_DIR_SEGMENTS moved with main file
- [ ] #3 Function signature switched from source_files: Map to project: Project parameter
- [ ] #4 Project.get_file_contents() (or equivalent read-only accessor) exposed
- [ ] #5 grep_call_sites_unindexed_tests gated behind include_unindexed_tests opt-in flag
- [ ] #6 Skill re-export module preserves old import path
- [ ] #7 Inverted grep-index optimization preserved (no quadratic regression)
- [ ] #8 pnpm test passes in packages/core and self-repair-pipeline
<!-- AC:END -->
