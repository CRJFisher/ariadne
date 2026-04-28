---
id: TASK-190.17
title: >-
  Fold known-false-positive classification into core; collapse skill to thin
  caller
status: To Do
assignee: []
created_date: "2026-04-28 19:11"
updated_date: "2026-04-28 21:26"
labels:
  - self-repair
  - entrypoint-analysis
  - core-refactor
  - breaking-change
dependencies: []
documentation:
  - /Users/chuck/.claude/plans/we-recently-implemented-the-lively-sparrow.md
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Today `Project.get_call_graph().entry_points` returns a raw `SymbolId[]` that mixes true positives with **known false positives** — `@app.route` handlers, pytest fixtures, Python dunders, JSX components, dynamic dispatch, etc. The knowledge of these blind spots already exists, but it lives in `.claude/skills/self-repair-pipeline/` (179 rules: 8 `permanent`, 171 `wip`). Every fresh consumer of the core API (the MCP `list_entrypoints` tool, library users, future skills) re-receives the noise.

This sub-tree moves classification into `@ariadnejs/core` so that:

- `Project.get_call_graph()` returns a clean list of probably-dead functions only — basic users see no framework noise by default.
- A new `Project.get_classified_entry_points()` returns `{ true_entry_points, known_false_positives }` for triage workflows (the self-healing pipeline still uses this).
- The MCP tool gains a `show_suppressed` opt-in flag for triage cases.
- The self-healing-pipeline skill becomes a **thin caller** of the new core API; its real job narrows to discovering new false-positive patterns and proposing rules back to core.
- The triage-curator skill's renderer now emits classifier source into the core package — so its codegen affects runtime.

## Design constraints (settled with the user)

1. **Two tiers only — basic and triage.** No grey-area / "uncertain" / "low confidence" bucket.
2. **Binary classification.** A rule either filters or it doesn't. Match confidence is the curator's concern when authoring rules, not a public API dimension.
3. **`wip` is skill-internal.** The curator's `proposed → wip → permanent → fixed` lifecycle stays inside the skill. Core only ever sees `permanent` rules.

## Shipping model

**Single PR — not piecemeal.** All sub-sub-tasks land together. Per-task dependencies indicate execution order (so an executing agent can sequence the work safely), not separate landing points.

## Sub-sub-tasks (190.17.1 … 190.17.18)

Sequenced by dependency:

- `.1, .2` — naming hygiene (renames before structural moves)
- `.3 → .4 → .5 → .6` — core-side migration (types → diagnostics → orchestrator → API + permanent slice)
- `.7` — MCP surface
- `.8 – .11` — self-healing-pipeline retarget
- `.12 – .14` — triage-curator retarget
- `.15` — documentation sweep
- `.16` — release: changeset, publish, persisted-state policy doc, stale CI cleanup
- `.18` — state hygiene: cache schema bumps, hooks audit, registry schema_version
- `.17` — equivalence verification using `diff_runs.ts`

## Success criteria

A fresh `npm install @ariadnejs/core` + `Project.get_call_graph()` on a Flask app returns no `@app.route` handlers in `entry_points`. The skill is no longer needed for this filtering — only for _discovering new patterns_.

## Plan

Full design rationale, file-by-file scope, performance analysis, risks, and verification protocol live in the plan file at `/Users/chuck/.claude/plans/we-recently-implemented-the-lively-sparrow.md`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Sub-sub-tasks 190.17.1 through 190.17.18 are created and linked under this parent
- [ ] #2 All 18 sub-sub-tasks land together in a single PR
- [ ] #3 Project.get_call_graph().entry_points returns true positives only by default on a Flask fixture
- [ ] #4 Project.get_classified_entry_points() returns { true_entry_points, known_false_positives } with EntryPointClassification labels
- [ ] #5 MCP list_entrypoints tool defaults to clean output and accepts a show_suppressed flag
- [ ] #6 self-healing-pipeline runs end-to-end against the new core API; no in-skill auto_classify invocation remains
- [ ] #7 triage-curator's render_classifier emits classifier source into packages/core/src/classify_entry_points/builtins/, compiling cleanly
- [ ] #8 Linked major bump changeset is published for @ariadnejs/core + @ariadnejs/types
- [ ] #9 diff_runs.ts equivalence check pre/post on a fixed commit shows zero flipped verdicts and minimal group churn
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

## Holistic concerns from review (resolved)

The post-creation 10-agent review surfaced five holistic concerns. Each has been resolved:

1. **`.16` mixed two reversibility profiles** (release cliff + reversible state hygiene). **Resolved**: split into TASK-190.17.16 (release: changeset, publish, persisted-state policy doc, stale CI cleanup) and TASK-190.17.18 (state hygiene: cache schema bumps, hooks audit, registry schema_version).

2. **Stale CI step at `test.yml:54` in `.16` looked like scope creep**. **Resolved**: user chose to keep it bundled in `.16`, since it lands in the same PR window and is low-effort.

3. **`.15` (docs sweep) sequenced too late for in-flight TASK-190.16.\* annotations**. **Resolved**: annotation work moved into `.6` (lands when paths actually change). `.15` retains canonical-source docs (READMEs, processing-pipeline, MCP).

4. **No rollback drill in `.17`**. **Resolved**: not needed — the migration ships as a single PR (not piecemeal), so per-task rollback drills add no value beyond the forward equivalence check.

5. **`.5`, `.11`, `.12` all touched builtins regeneration with implicit ownership**. **Resolved**: `.11` is now the authoritative owner of the builtins regen contract; `.5` ships a one-time bulk codemod, `.12` ships a one-time bulk re-render, and ongoing drift is caught by `.11`'s CI step.
<!-- SECTION:PLAN:END -->
