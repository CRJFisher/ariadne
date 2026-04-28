---
id: TASK-190.17.15
title: "Documentation sweep: READMEs, processing pipeline, MCP docs, SKILL.md cleanup"
status: To Do
assignee: []
created_date: "2026-04-28 19:20"
updated_date: "2026-04-28 21:25"
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
- `.claude/skills/self-repair-pipeline/SKILL.md:379` — drop the `extract_entry_points.ts` row from the "Architecture: Key Modules" table (file moved to core).
- `.claude/skills/self-repair-pipeline/SKILL.md:388` — drop or update the `entry_point_types.ts` row (graduated to `@ariadnejs/types`; rename `EnrichedFunctionEntry` → `EnrichedEntryPoint`).
- `.claude/skills/self-repair-pipeline/SKILL.md` (general) — frame the "thin caller of `@ariadnejs/core`" prose within the existing run-lifecycle narrative; the operator loop (`prepare_triage` → triage → `finalize_triage` / `abandon_run`) is preserved; only the classifier's _home_ moves.
- `.claude/skills/self-repair-pipeline/README.md` — mention the generated `permanent` slice in core alongside the canonical registry.

## Verification

- `pnpm build` passes (any TS code samples in docs that are part of the build still compile).
- A reader following `packages/core/README.md` can call `Project.get_classified_entry_points()` and get a working example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 packages/core/README.md updated for new entry_points semantics + get_classified_entry_points example
- [ ] #2 docs/PROCESSING_PIPELINE.md CallGraph diagram updated to reflect classification step
- [ ] #3 Root README.md sample code refreshed for new entry_points semantics
- [ ] #4 packages/mcp/README.md updated for show_suppressed flag and classification semantics
- [ ] #5 packages/mcp/SETUP.md updated for show_suppressed flag
- [ ] #6 docs/core-limitations.md describes blind spots in terms of new classification taxonomy
- [ ] #7 self-repair-pipeline SKILL.md:337 stale extract_entry_points.ts row removed
- [ ] #8 self-repair-pipeline SKILL.md:346 stale entry_point_types.ts row removed/updated
- [ ] #9 self-repair-pipeline SKILL.md prose frames new thin-caller role inside the existing run-lifecycle narrative
- [ ] #10 self-repair-pipeline README.md mentions the generated permanent slice in core alongside the canonical registry
- [ ] #11 Code samples in docs compile via pnpm build (no broken example)
- [ ] #12 All updated docs are written in canonical, present-tense style (no 'old approach' / 'new way' framing)
<!-- AC:END -->
