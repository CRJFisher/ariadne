---
id: TASK-190.17.15
title: "Documentation sweep: READMEs, processing pipeline, MCP docs, SKILL.md cleanup"
status: Done
assignee: []
created_date: "2026-04-28 19:20"
updated_date: "2026-06-17"
labels:
  - docs
dependencies:
  - TASK-190.17.7
  - TASK-190.17.11
  - TASK-190.17.14
parent_task_id: TASK-190.17
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Update all repo documentation that references the old API shape, paths, or types. The structural moves have landed by this point — this sub-sub-task is a pure docs sweep.

(In-flight TASK-190.16.\* annotations are out of scope here — they land with `.6` so the in-flight tasks aren't stale during the migration window.)

## File touches

- `packages/core/README.md:41,42,85,90,93,157` — update `entry_points` shape descriptions; add a `get_classified_entry_points()` example; document the new `EntryPointClassification` discriminated union.
- `docs/PROCESSING_PIPELINE.md:76` — `CallGraph` shape diagram; add a one-line note about classification being a final step inside the entry-point detection branch.
- Root `README.md:103-104` — sample code snippet currently uses `project.get_call_graph().entry_points`; refresh.
- `packages/mcp/README.md:144` — replace the `get_call_graph` "Coming Soon" line with `list_entrypoints` semantics + new `show_suppressed` flag (this section currently lists future tools; the entry should be promoted to active and updated).
- `packages/mcp/SETUP.md:216` — same: replace the `get_call_graph` "Coming Soon" line with current `list_entrypoints` + `show_suppressed` description.
- `packages/mcp/docs/core-limitations.md:44,48` — describe Ariadne's blind spots in terms of the new classification taxonomy. (Note: this file is at `packages/mcp/docs/core-limitations.md`, not `docs/core-limitations.md`.)
- `.claude/skills/triage-entrypoints/SKILL.md:379` — drop the `extract_entry_points.ts` row from the "Architecture: Key Modules" table (file moved to core).
- `.claude/skills/triage-entrypoints/SKILL.md:388` — drop or update the `entry_point_types.ts` row (graduated to `@ariadnejs/types`; rename `EnrichedFunctionEntry` → `EnrichedEntryPoint`).
- `.claude/skills/triage-entrypoints/SKILL.md` (general) — frame the "thin caller of `@ariadnejs/core`" prose within the existing run-lifecycle narrative; the operator loop (`prepare_triage` → triage → `finalize_triage` / `abandon_run`) is preserved; only the classifier's _home_ moves.
- `.claude/skills/triage-entrypoints/README.md` — mention the generated `permanent` slice in core alongside the canonical registry.

## Verification

- `pnpm build` passes (any TS code samples in docs that are part of the build still compile).
- A reader following `packages/core/README.md` can call `Project.get_classified_entry_points()` and get a working example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 packages/core/README.md updated for new entry_points semantics + get_classified_entry_points example
- [x] #2 docs/PROCESSING_PIPELINE.md CallGraph diagram updated to reflect classification step
- [x] #3 Root README.md sample code refreshed for new entry_points semantics
- [x] #4 packages/mcp/README.md updated for show_suppressed flag and classification semantics
- [x] #5 packages/mcp/SETUP.md updated for show_suppressed flag
- [x] #6 docs/core-limitations.md describes blind spots in terms of new classification taxonomy
- [x] #7 triage-entrypoints SKILL.md:337 stale extract_entry_points.ts row removed
- [x] #8 triage-entrypoints SKILL.md:346 stale entry_point_types.ts row removed/updated
- [x] #9 triage-entrypoints SKILL.md prose frames new thin-caller role inside the existing run-lifecycle narrative
- [x] #10 triage-entrypoints README.md mentions the generated permanent slice in core alongside the canonical registry
- [x] #11 Code samples in docs compile via pnpm build (no broken example)
- [x] #12 All updated docs are written in canonical, present-tense style (no 'old approach' / 'new way' framing)
<!-- AC:END -->

## Implementation Notes

All ACs were satisfied by earlier commits in the 190.17 series (`feat(190.17.12-14)`, `backlog(190.17.1-3)`):

- **AC#1**: `packages/core/README.md` documents `get_classified_entry_points()` with a full example showing `framework_invoked`, `dunder_protocol`, `test_only`, `indirect_only` classification arms.
- **AC#2**: `docs/PROCESSING_PIPELINE.md` CallGraph diagram already includes the `classify_entry_points` step and `ClassifiedEntryPoints` output shape.
- **AC#3**: Root `README.md` sample uses `project.get_call_graph()` returning true positives only + `project.get_classified_entry_points()` for triage.
- **AC#4,5**: `packages/mcp/README.md` and `SETUP.md` document `list_entrypoints` with `--show-suppressed` CLI flag and `ARIADNE_SHOW_SUPPRESSED=1` env var.
- **AC#6**: `packages/mcp/docs/core-limitations.md` describes blind spots in terms of `EntryPointClassification` kinds (`framework_invoked`, `dunder_protocol`, `test_only`, `indirect_only`).
- **AC#7,8**: `.claude/skills/triage/SKILL.md` Architecture table has no `extract_entry_points.ts` or `entry_point_types.ts` rows — removed in the 190.17 series. The table correctly points to the core package for those modules.
- **AC#9**: SKILL.md states the skill is "a thin caller of `@ariadnejs/core`" and lists the core modules it delegates to.
- **AC#10**: `triage/README.md` mentions "A generated `permanent`-status slice is bundled into `@ariadnejs/core` at `packages/core/src/classify_entry_points/permanent_data.ts`".
- **AC#11,12**: All documentation is in canonical present-tense style; no TS samples in docs that fall outside the build.
