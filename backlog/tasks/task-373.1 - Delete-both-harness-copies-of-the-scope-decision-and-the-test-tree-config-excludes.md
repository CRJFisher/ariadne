---
id: TASK-373.1
title: "Delete both harness copies of the scope decision and the test-tree config excludes"
status: To Do
assignee: []
created_date: "2026-07-29 09:36"
labels:
  - plan-export
  - coverage_config
dependencies: []
parent_task_id: TASK-373
priority: high
ordinal: 1000
plan_dedup_keys:
  - a13a2039a01a77c1ba867a8002be9be62068fdae1a2c4434141321e9f87c93a2
plan_source_tasks:
  - pt-8b7e2eb56b18a7e6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The scope decision that sub-task 1 removed from `load_project` exists in two further, drifting copies inside the triage harness, plus in two project configs. Until they go, the corpus stays narrow no matter what the core does.

- `.claude/skills/triage/scripts/detect_entrypoints.ts` builds `test_file_filter` (`:348-353`) and applies it twice (`:367`, `:401-403`), then walks and re-reads the whole repository a second time (`:376-403`, `:414-454`) purely to feed the fallback pass's `indexed_source_files` argument (`:492`) — `extract_entry_point_diagnostics` already reads `project.get_file_contents()` directly (`:105`).
- `.claude/skills/triage/scripts/prepare_triage.ts`'s `load_project_for_classification` (`:248-273`) is an independent copy: it hard-codes the test `file_filter` (`:260-263`) and `include_tests: false` (`:270`), while `load_index_scope` (`:128-137`) reads only `folders` and `exclude` from the project config and silently discards `include_tests`. A config setting `include_tests: true` therefore produces one corpus in `detect_entrypoints` and a different one here.
- `exclude` in a project config is a **corpus** exclusion (`load_project.ts:82-85` → `should_ignore_path`) with no candidate-side counterpart. `django--django.json` drops `"tests"` and `sqlalchemy.json` drops `"test"` — exactly the edge deletion this epic removes. Both trees are `is_test_file` positives under the existing directory rules, so `include_tests: false` already suppresses them as candidates.

## Work plan

1. In `detect_entrypoints.ts`, delete `test_file_filter` (`:348-353`) and both applications (`:367`, `:401-403`). `include_tests` continues to flow to `trace_call_graph` (`:462-464`), now its only consumer and the only place it belongs.
2. Delete the second full walk and full re-read of the repository (`:376-403`, `:414-454`). Re-express both operator gates over `project.get_file_contents()`: the indexed/discovered ratio warning (`:408-412`) becomes a comparison against one walk, and the giant-file warning (`:432-437`) iterates the project's map.
3. In `prepare_triage.ts`, delete the `file_filter` from `load_project_for_classification` (`:260-263`), add `include_tests` to `IndexScopeFromConfig` (`load_index_scope`, `:128-137`), and thread it to `trace_call_graph` so the two scripts agree by construction rather than by coincidence.
4. Edit the project configs under `~/.ariadne/triage-entrypoints/project_configs/`: remove `"tests"` from `django--django.json` (keep `js_tests`, `scripts`, `docs`) and `"test"` from `sqlalchemy.json`. Sequence this after sub-task 1's `should_ignore_path` anchoring — sqlalchemy's unanchored `exclude: ["test"]` currently also removes `lib/sqlalchemy/testing/**`, which is production code, so the two changes compound and the file-count delta must be measured together.
5. Add a startup warning in `detect_entrypoints.ts`'s config resolution when an `exclude` entry names a directory that `is_test_file` would classify: such an entry silently deletes call edges for no candidate-set benefit.
6. Rewrite `.claude/skills/triage/scripts/detect_entrypoints.test.ts:59-160` against the new file-set semantics, and add a test that a project config with `include_tests: true` produces the same corpus and the same candidate gate in both `detect_entrypoints` and `prepare_triage`.
7. **Add integration tests covering every evidence case this cleanup owns**, with the fixture configs they need: a celery-shaped fixture whose tests live in `t/unit/`, `t/smoke/` and `t/integration/` (filename-marked `test_*.py`, matching no test _directory_ rule) yields the callee off the entry-point set; a django-shaped fixture with a config that excludes `"tests"` regains its caller once the exclude is dropped and still contributes zero candidates; a sqlalchemy-shaped fixture proves `lib/sqlalchemy/testing/**` is production code that returns to the corpus; a fixture config with `include_tests: true` yields identical corpora from both harness scripts.
8. **Measure and record.** Re-run `detect_entrypoints` on celery, typeorm, prisma, django, angular and TypeScript. Record entry-point count, wall-clock and cache-size deltas. Confirm the two rows this epic resolves outright (prisma `compileFile`, celery `long_running_task`) are gone, that no new entry point appears from a test file, and that the eight `should_ignore_path` rows either resolve or surface a different, named failure. Corpus growth is the real cost and it is uneven — typeorm `src/` 496 `.ts` vs `test/` 2748, django 923 non-test `.py` vs `tests/` 2004, celery 209 vs 209 — and this measurement is what sizes sub-tasks 1.2 and 1.3. If a corpus proves untenable the honest lever is a corpus _cap_ with a loud warning, never a silent discovery filter.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `test_file_filter` and both its applications are gone from `detect_entrypoints.ts`, and `include_tests` reaches only `trace_call_graph`.
- [ ] #2 The second repository walk and re-read in `detect_entrypoints.ts` is deleted; the indexed/discovered ratio warning and the giant-file warning are re-expressed over `project.get_file_contents()` and still fire.
- [ ] #3 `prepare_triage.ts` no longer sets a `file_filter`, `IndexScopeFromConfig` carries `include_tests`, and a test proves `detect_entrypoints` and `prepare_triage` produce the same corpus and the same candidate gate for a config with `include_tests: true`.
- [ ] #4 `django--django.json` no longer excludes `"tests"` and `sqlalchemy.json` no longer excludes `"test"`; a startup warning fires when an `exclude` entry names a directory `is_test_file` would classify.
- [ ] #5 Integration tests with fixture configs cover every evidence case: the celery `t/unit`, `t/smoke`, `t/integration` filename-marked shape, the django excluded-`tests` shape, the sqlalchemy `lib/sqlalchemy/testing/**` production-code shape, and the `include_tests: true` cross-script agreement.
- [ ] #6 `detect_entrypoints.test.ts:59-160` is rewritten against the new file-set semantics and passes.
- [ ] #7 A recorded measurement across celery, typeorm, prisma, django, angular and TypeScript reports entry-point count, wall-clock and cache-size deltas; prisma `compileFile` and celery `long_running_task` are absent from the entry-point sets and no new entry point comes from a test file.

<!-- AC:END -->
