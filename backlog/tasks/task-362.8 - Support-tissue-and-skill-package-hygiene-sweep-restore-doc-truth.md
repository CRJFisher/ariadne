---
id: TASK-362.8
title: "Support-tissue and skill-package hygiene sweep; restore doc truth"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - hygiene
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The residue of the program's consolidated small-items table
(`backlog/drafts/ia-review.refactor-program.md`): every row owned by no
area sub-task, plus the doc rewrites that must land after the code settles.
Effort S, risk low. Strictly last in the epic (wave 4) — the doc-truth items
describe final names, and the sweep is the closeout that verifies all 36
rows are accounted for.

### Rows owned by this task

Support tissue (`packages/core`):

- **Row 23** — export the five pipeline-stage labels from `core/src/profiling`
  as one shared const; consume in `project.ts`, `index_single_file.ts`, and
  the `update_file_timing` switch (a rename currently silently zeroes timing
  fields).
- **Row 24** — drop `TimingEntry`/`FileTimingEntry` from the profiling barrel
  (no external importer); rename type `FileTimingEntry` →
  `FilePipelineTimingEntry`.
- **Row 36** — extract a shared `TEST_DIR_PATTERNS` const from
  `project/detect_test_file.typescript.ts` / `.javascript.ts` (~60% verbatim
  duplication) without collapsing the correct language split.

Skill packages:

- **Row 26** — move `skill-fs/src/classifier_regressions.ts`
  `aggregate_classifier_regressions` + its input type into
  `.claude/skills/triage/src/finalize/` (sole caller); drop the dead
  `ClassifierRegression*` re-exports from file and barrel.
- **Row 27** — `skill-fs/src/errors.ts` → `node_error_code.ts` (holds one
  function, `error_code`).
- **Row 29** — delete `.claude/skills/plan/src/store/paths.ts`
  `get_repo_root`; import `repo_root` from `@ariadnejs/skill-protocol`.

Doc truth (lands against settled code):

- **Row 32** — rewrite `.claude/rules/trace-call-graph.md` to match reality
  (it documents `filter_entry_points.ts`/`.python.ts`, neither exists; the
  behavior lives in `classify_entry_points/` — describe the
  post-TASK-362.4 shape).

Closeout:

- Sweep the program's 36-row table and confirm every row is landed or
  rejected-with-reason across TASK-362.1–.8 (the per-task ownership is
  recorded in each sub-task's description). Any row discovered unowned
  lands here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Rows 23, 24, 36 landed: one shared stage-label const consumed at all
      three sites (with a test that a label rename cannot silently zero
      timing fields); profiling barrel trimmed; `TEST_DIR_PATTERNS` shared.
- [ ] Rows 26, 27, 29 landed: `aggregate_classifier_regressions` lives with
      its sole caller; `node_error_code.ts` renamed; plan's `get_repo_root`
      deleted in favor of `repo_root`.
- [ ] Row 32 landed: `trace-call-graph.md` describes only files that exist,
      in canonical present-tense style.
- [ ] The 36-row closeout table is complete: every row cross-referenced to
      the sub-task that landed it, or rejected with a recorded reason.
- [ ] Full test suite green across core, skill-fs, and the skill workspaces.

<!-- AC:END -->
