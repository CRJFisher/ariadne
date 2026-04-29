---
id: TASK-190.17.9
title: "self-healing: rewrite `scripts/detect_entrypoints.ts` to use core API"
status: Done
assignee: []
created_date: "2026-04-28 19:17"
updated_date: "2026-04-28 19:33"
labels:
  - self-repair
  - skill-retarget
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

`.claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts:460-509` runs `project.get_call_graph()` then locally calls `extract_entry_points(call_graph, source_files, ...)` and `attach_unindexed_test_grep_hits(...)`. After `.4` and `.5` move that logic into core, the script becomes a thin caller of the new primitive.

## Rewrite

Replace lines 460-509 with:

```ts
const call_graph = project.get_call_graph({ include_tests });
const enriched = enrich_call_graph(call_graph, project, {
  registry: full_skill_registry,
  include_unindexed_tests: true, // skill always wants this for triage
});
// build AnalysisResult from enriched.call_graph + enriched.classified_entry_points + enriched.diagnostics_by_id
```

Helpers `attach_unindexed_test_grep_hits`, `collect_unindexed_test_files`, `UNINDEXED_TEST_DIR_SEGMENTS` move into core (during `.4`), or stay in the skill if they are pipeline-specific. Decide based on whether they need `Project` access — anything purely about path predicates can stay skill-side.

## Producer contract — preserve

The script must continue to emit `AnalysisResult` with:

- `project_name: string` (from `--project` flag or `analysis.project_name`)
- `project_path: string` (absolute path)
- `entry_points[*].file_path: string` (absolute — the skill relativizes for portability inside `build_finalization_output.ts`)

Downstream (`prepare_triage`, `tp_cache`, `build_finalization_output`) depends on this contract.

## File touches

- `.claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts:39-44` — drop imports for `EnrichedFunctionEntry`, `extract_entry_points`, `build_constructor_to_class_name_map`, `detect_language` if they are no longer used after rewrite.
- `.claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts:460-509` — the rewrite.
- `.claude/skills/self-repair-pipeline/scripts/detect_entrypoints.test.ts:11` — update import (mechanical from `.1`).

## Verification

- `pnpm test` in `.claude/skills/self-repair-pipeline/` passes.
- `pnpm exec tsx scripts/detect_entrypoints.ts --config project_configs/core.json` produces an `AnalysisResult` JSON whose entry-point shapes are identical to the pre-rewrite output (modulo `EnrichedFunctionEntry` → `EnrichedEntryPoint` rename).
- `prepare_triage.ts` consumes the new output without changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 scripts/detect_entrypoints.ts:460-509 replaced with enrich_call_graph call
- [x] #2 AnalysisResult producer contract preserved (project_name, absolute project_path, absolute entry_point file_path)
- [x] #3 Helpers attach_unindexed_test_grep_hits, collect_unindexed_test_files moved to core or kept in skill based on Project dependency
- [x] #4 Imports at scripts/detect_entrypoints.ts:39-44 cleaned up to drop now-unused references
- [x] #5 scripts/detect_entrypoints.test.ts updated for type renames
- [x] #6 Producing AnalysisResult JSON shape unchanged (same field names) so prepare_triage works without changes
- [x] #7 pnpm test passes in .claude/skills/self-repair-pipeline/
<!-- AC:END -->
