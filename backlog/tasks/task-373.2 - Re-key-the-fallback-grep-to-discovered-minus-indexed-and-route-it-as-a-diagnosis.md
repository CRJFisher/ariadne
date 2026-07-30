---
id: TASK-373.2
title: "Re-key the fallback grep to discovered-minus-indexed and route it as a diagnosis"
status: To Do
assignee: []
created_date: "2026-07-29 09:36"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-373
priority: high
ordinal: 2000
plan_dedup_keys:
  - eeae3a057421f63021bf31001f47b39ce18f0ad48c75d7764e1b4759ebea730b
plan_source_tasks:
  - pt-674e08daba8a312a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

After corpus completion the residue is not empty: a project config `exclude`, a `--folders` scope, and files `load_project` drops on an indexing error all leave real callers discovered and unindexed. The compensation that should cover them cannot: `attach_unindexed_test_grep_hits.ts` narrows a whole-repo walk to four hard-coded path segments (`UNINDEXED_TEST_DIR_SEGMENTS`, `:51-56`) with its own extension list (`TEST_FILE_EXTENSIONS`, `:58-67`) — a second, drifting definition of predicates `project/detect_test_file.ts` and `project/file_loading.ts:7` already own — and it is handed the same `combined_patterns` as discovery (`detect_entrypoints.ts:378,495`), so it can never re-find anything an `exclude` removed. Celery is the proof: every celery member in this group has `grep_call_sites_unindexed_tests: []`, as do django's. The result is reported through an ad-hoc boolean (`callers_only_in_unindexed_tests`) and a precedence hack in `derive_fault_area` (`ariadne_fault_area.ts:261-268`) rather than as a diagnosis.

The fix is to make the file set exactly _discovered − indexed_ and to state the route once, as a diagnosis member. `coverage_config` survives — not as a judgement bucket, but as the destination of a determinate statement: the caller exists in a file we chose not to, or failed to, index.

## Work plan

1. **Land the type changes** (they gate everything after this). In `packages/types/src/entry_point.ts`: add `"callers-outside-indexed-corpus"` and `"references-without-call-syntax"` to `EntryPointDiagnosis`; rename `grep_call_sites_unindexed_tests` to `grep_call_sites_outside_index`; add `reference_sites: ReferenceSiteDiagnostic[]` and the `ReferenceSiteDiagnostic` interface (`file_path`, `line`, `content`, `reference_kind`, `access_type`, `receiver_kind`); delete `callers_only_in_unindexed_tests`. In `packages/types/src/ariadne_fault_area.ts`: delete `DeriveFaultAreaInput.callers_only_in_unindexed_tests` (`:127`) and add the two members to `ENTRY_POINT_DIAGNOSIS_SET` (`:180-185`) — the `Record<EntryPointDiagnosis, true>` shape turns every unmapped consumer into a compile error, which is the work list for this sub-task and for 1.3.
2. **`git mv` `attach_unindexed_test_grep_hits.ts` to `attach_out_of_index_grep_hits.ts`** — the name must be true of the new file set.
3. **Rewrite the file set.** Delete `UNINDEXED_TEST_DIR_SEGMENTS` (`:51-56`), `TEST_FILE_EXTENSIONS` (`:58-67`) and the narrowing at `:156`. Rename `collect_unindexed_test_files` to `collect_files_outside_index`: keep the `find_source_files(project_path, project_path, gitignore_patterns)` walk (`:144-148`), which is already rooted at the project so `--folders`-scoped-out files are discovered, but stop threading `options.exclude` into it; keep only gitignore plus the internal `IGNORED_DIRECTORIES` bound so `node_modules` and `dist` never enter the grep. Replace the extension list with `detect_language(full) !== undefined`. Union in the dropped-file set `load_project` now returns (sub-task 1). Subtract `project.get_file_contents()`. `UnindexedTestGrepOptions` collapses to `project_path`.
4. **Reuse sub-task 1's hit qualification here** — definition-line and comment-line rejection — or the same phantom declaration and doc-comment hits reappear on the out-of-index side.
5. **Write `grep_call_sites_outside_index` (`:119`) and stop writing the deleted boolean (`:127-128`).** Delete both dead `<anonymous>` guards: the fallback pass's `if (grep_name === "<anonymous>") continue;` (`:116`) and `grep_for_calls`'s `if (name === "<anonymous>") return [];` (`extract_entry_point_diagnostics.ts:430`). Both are unreachable because `detect_entry_points` filters anonymous nodes first (`trace_call_graph.ts:79-81`). Re-keying `enrich_call_graph`'s map (`enrich_call_graph.ts:98-121`) fixes nothing either — both sides carry the same name. The five rows behind those guards close in `type-model-completion`, whose first sub-task stops `symbol_factories.javascript.ts:707` minting `anonymous_function_symbol` for a **named** function expression; this sub-task only removes the dead code and must not claim those rows as resolved.
6. **Sequence extraction and the walk under one chain**, with `compute_diagnosis` computed once at the end: branch 2 — no indexed grep hits but out-of-index hits exist — must be evaluated by the owner that populates the out-of-index array. Map `callers-outside-indexed-corpus` → `{ area: "coverage_config", needs_judgement: false }` in `derive_fault_area` (`ariadne_fault_area.ts:270-295`) and delete the coverage-precedence block (`:261-268`).
7. **Update the renamed exports and the stage boundary**: `packages/core/src/classify_entry_points/index.ts:17-21`, `packages/core/src/index.ts:65-67`, and `.claude/hooks/stage_boundary.ts:42`, whose grandfathered edge `classify_entry_points/attach_unindexed_test_grep_hits.ts → project/file_loading` names the renamed file — update it, do not delete it, because the renamed pass still walks the tree. `.claude/hooks/stage_boundary.test.ts:315` moves with it.
8. **Add integration tests over a real `Project` and temp directories covering every evidence case this axis owns.** The corpus axis needs real files on disk: (a) a celery-shaped project whose only caller lives in `t/unit/utils/test_collections.py` — matching no former `UNINDEXED_TEST_DIR_SEGMENTS` entry — yields `callers-outside-indexed-corpus` and `derive_fault_area → coverage_config` for the `_LRUpop` shape; (b) a project whose only caller sits in a `--folders`-scoped-out directory does the same, covering the Angular `r3_control_flow.ts`, rustc `mk_attr_name_value_str` and tokio `create_blocking_pool` shapes; (c) a project whose only caller sits in a config-`exclude`d directory does the same, covering django's shape; (d) a file that `load_project` drops on an indexing error is still grepped and still yields `callers-outside-indexed-corpus`, covering the express `lib/response.js` case (`Duplicate export name "res"`) behind `onend`, `onfile`, `onstream`, `ondirectory` and `attachment`; (e) a declaration line and a comment line in an out-of-index file produce no hit, proving step 4.
9. **Measure the added cost.** The set grows from four test-directory segments to everything discovered but unindexed; the walk is unchanged, the added cost is the regex pass and the inverted index over more files. After sub-task 1.1's corpus completion the set should be small — measure it here rather than assuming it, reusing the per-name `MAX_GREP_HITS` cap and warning loudly rather than truncating silently.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `EntryPointDiagnosis` carries `callers-outside-indexed-corpus` and `references-without-call-syntax`; `grep_call_sites_outside_index` replaces `grep_call_sites_unindexed_tests`; `reference_sites` and `ReferenceSiteDiagnostic` exist; `callers_only_in_unindexed_tests` is gone from `packages/types`.
- [ ] #2 `attach_out_of_index_grep_hits.ts` exists via `git mv`; `UNINDEXED_TEST_DIR_SEGMENTS`, `TEST_FILE_EXTENSIONS`, the segment narrowing, the `options.exclude` threading and both dead `<anonymous>` guards are deleted.
- [ ] #3 The out-of-index file set is exactly discovered minus indexed: the walk keeps gitignore and `IGNORED_DIRECTORIES` only, language is decided by `detect_language`, and `load_project`'s dropped-file set is unioned in.
- [ ] #4 Out-of-index hits are qualified by the same definition-line and comment-line rules as indexed hits.
- [ ] #5 `compute_diagnosis` runs once at the end of the extract-to-attach chain and returns `callers-outside-indexed-corpus` when there are no indexed hits but out-of-index hits exist; `derive_fault_area` maps it to `{ area: "coverage_config", needs_judgement: false }` and the coverage-precedence block is deleted.
- [ ] #6 Integration tests with on-disk fixtures cover every evidence case: celery `t/unit/utils/test_collections.py` (`_LRUpop`), a `--folders`-scoped-out caller (Angular `r3_control_flow.ts`, rustc `mk_attr_name_value_str`, tokio `create_blocking_pool` shapes), a config-`exclude`d caller (django shape), a file dropped by `load_project` (express `lib/response.js` behind `onend`, `onfile`, `onstream`, `ondirectory`, `attachment`), and declaration/comment hits in out-of-index files.
- [ ] #7 Barrel exports and `.claude/hooks/stage_boundary.ts:42` name the renamed file, and `stage_boundary.test.ts:315` passes.
- [ ] #8 A recorded measurement of the out-of-index grep cost on the largest fixture corpus, with `MAX_GREP_HITS` still bounding per-entry size.

<!-- AC:END -->
