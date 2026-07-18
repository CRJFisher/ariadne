---
id: TASK-362.8
title: "Support-tissue and skill-package hygiene sweep; restore doc truth"
status: Done
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

- [x] Row 36 landed: `TEST_DIR_PATTERNS` shared across the TS/JS detectors,
      with a test pinning the pattern set and its anchoring. Rows 23, 24 are
      rejected as superseded: the profiler subsystem (stage labels,
      `update_file_timing`, the profiling barrel) was deleted wholesale in
      `e21bc26a`, so no code remains to consolidate — see the Closeout Audit.
- [x] Rows 26, 27, 29 landed: `aggregate_classifier_regressions` lives with
      its sole caller; `node_error_code.ts` renamed; plan's `get_repo_root`
      deleted in favor of `repo_root`.
- [x] Row 32 landed: `trace-call-graph.md` describes only files that exist,
      in canonical present-tense style.
- [x] The 36-row closeout table is complete: every row cross-referenced to
      the sub-task that landed it, or rejected with a recorded reason.
- [x] Full test suite green across core, skill-fs, and the skill workspaces.

<!-- AC:END -->

## Closeout Audit

Every row of the program's 36-row small-items table
(`backlog/drafts/ia-review.refactor-program.md`), cross-referenced to the
sub-task that owns it. Ownership sums to exactly 36; no row is unowned.
Statuses reflect the tree at the audit commit: **landed** (owner is Done and
the artifact is verifiable in-tree), **this task** (landed by 362.8),
**rejected** (recorded reason), **pending** (owner not yet Done — these rows
re-verify when 362.5/.6/.7 merge; the audit cannot close them early).

| Row | Item | Owner | Status |
| --- | --- | --- | --- |
| 1 | `extract_nested_definitions.ts` → `extract_parameters.ts` | 362.6 | pending |
| 2 | `classify_entry_points.ts` → `auto_classify.ts` | 362.4 | landed |
| 3 | `definitions.ts` → `definition_builder.ts` | 362.2 | landed |
| 4 | `scopes/utils.ts` → `scope_lookup.ts` | 362.2 | landed |
| 5 | `introspection/` → `project_queries/` | 362.6 | pending |
| 6 | delete `list_name_collisions.ts` | 362.6 | pending |
| 7 | `explain_call_site` wire-or-delete decision | 362.6 | pending |
| 8 | `is_python_file` → `registries/export.python.ts` | 362.3 | landed |
| 9 | `file_folders_test_helper.ts` → `resolution_test_helpers.ts` | 362.3 | landed |
| 10 | `type_preprocessing/constructor.ts` → `constructor_bindings.ts` | 362.3 | landed |
| 11 | delete `scope_to_definitions_index` | 362.6 | pending |
| 12 | un-export `find_class_definition`/`find_associated_constructor` | 362.3 | landed |
| 13 | delete orphaned JSDoc in `type_preprocessing/member.ts` | 362.3 | landed |
| 14 | trim `import_resolution/index.ts` | 362.3 | landed |
| 15 | replace private `file_exists` with `has_file_in_tree` | 362.3 | landed |
| 16 | delete `registry_permanent.ts` shim | 362.4 | landed |
| 17 | `permanent_data.ts` → `registry_permanent_data.ts` | 362.4 | landed |
| 18 | widen `check_framework-lifecycle-override` gate to JS | 362.4 | landed |
| 19 | `check_string-keyed-dispatch` hardcoded path | 362.4 | landed (handed off to the reconcile-registry flow per that task's Decision 6) |
| 20 | `capture_handlers/types.ts` → `handler_types.ts` | 362.2 | landed |
| 21 | `loop_variable_handlers.python.ts` → `control_flow_variable_handlers.python.ts` | 362.2 | landed |
| 22 | split parser registry out of `query_loader.ts` | 362.1 | landed |
| 23 | shared pipeline-stage-label const in `core/src/profiling` | 362.8 | rejected — superseded: the profiler subsystem (including `update_file_timing` and the stage labels) was deleted wholesale in `e21bc26a`; no code remains to consolidate |
| 24 | trim profiling barrel; rename `FileTimingEntry` | 362.8 | rejected — superseded: same deletion (`e21bc26a`) removed `TimingEntry`/`FileTimingEntry` and the barrel itself |
| 25 | single owner for persistence save-path | 362.6 | pending |
| 26 | move `aggregate_classifier_regressions` into triage finalize | 362.8 | this task |
| 27 | `skill-fs/src/errors.ts` → `node_error_code.ts` | 362.8 | this task |
| 28 | `tool_registry.ts` → `register_tools.ts` | 362.7 | pending |
| 29 | delete plan's `get_repo_root` for `repo_root` | 362.8 | this task |
| 30 | delete stale `@deprecated` marker in `type_id.ts` | 362.5 | pending |
| 31 | delete `SyntacticFeatures.is_inside_try` | 362.5 | pending |
| 32 | rewrite `.claude/rules/trace-call-graph.md` | 362.8 | this task (also listed in 362.9 item 1; 362.9 verifies rather than re-edits) |
| 33 | record the language-mechanism rule in `file-naming.md` | 362.1 | landed |
| 34 | builtins placement rationale in `builtins/index.ts` | 362.4 | landed |
| 35 | delete stale `dist/` build fossils | 362.6 | pending |
| 36 | shared `TEST_DIR_PATTERNS` const | 362.8 | this task |

## Implementation Notes

## High-level summary

This task is the residue sweep of the IA refactor program's 36-row
small-items table: the rows no area sub-task owns, plus the doc rewrites
that only make sense against settled code. The code rows relocate three
pieces of support tissue to the single place each is consumed, and the doc
row restores `trace-call-graph.md` to describing files that exist.

`aggregate_classifier_regressions` lives in
`.claude/skills/triage/src/finalize/classifier_regressions.ts`, beside its
sole caller `output.ts`; the `ClassifierRegression*` types are imported
from their canonical home in `@ariadnejs/types`, and skill-fs — having lost
its only `@ariadnejs/types` consumer — sheds that dependency and its
tsconfig project reference entirely. skill-fs's `node_error_code.ts` names
what the module holds (the single `error_code` helper); every external
caller reaches it through the unchanged barrel. The plan skill resolves the
repo root through `repo_root()` from `@ariadnejs/skill-protocol` — the
marker-file walk-up, anchored by a direct test in skill-protocol — rather
than a private fixed-depth path climb. The TS/JS test-file detectors share
`project/test_dir_patterns.ts`, whose `TEST_DIR_PATTERNS` const and
`is_in_test_dir` predicate preserve the load-bearing anchoring asymmetry
(`__tests__` matches unanchored; `/tests` and `/test` are slash-anchored),
pinned by a focused test; the Python/Rust detectors keep their own pattern
sets, so the language split is intact.

Rows 23 and 24 are rejected, not landed: the profiler subsystem they
target was deleted wholesale in `e21bc26a`, so no stage labels, timing
switch, or profiling barrel remain to consolidate. The Closeout Audit
table above cross-references all 36 rows; the ten rows owned by 362.5,
362.6, and 362.7 are recorded as pending and re-verify when those tasks
merge. Row 32 is also listed by 362.9, which verifies rather than
re-edits.

Verified by execution: core (3421 tests), skill-fs, skill-protocol,
triage, and plan suites green; typecheck across all seven tsconfigs;
the changed surfaces driven end-to-end against built artifacts (barrel
`error_code`, TS/JS/Python detection, plan backlog paths resolving via
`repo_root()`, the aggregation from its new home). A six-lens review
confirmed behavioral equivalence of the extraction and doc truth of the
rewrite.
