---
id: TASK-373.1
title: "Delete both harness copies of the scope decision and the test-tree config excludes"
status: In Progress
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

- [x] #1 `test_file_filter` and both its applications are gone from `detect_entrypoints.ts`, and `include_tests` reaches only `trace_call_graph`.
- [ ] #2 The second repository walk and re-read in `detect_entrypoints.ts` is deleted; the indexed/discovered ratio warning and the giant-file warning are re-expressed over `project.get_file_contents()` and still fire.
- [x] #3 `prepare_triage.ts` no longer sets a `file_filter`, `IndexScopeFromConfig` carries `include_tests`, and a test proves `detect_entrypoints` and `prepare_triage` produce the same corpus and the same candidate gate for a config with `include_tests: true`.
- [x] #4 `django--django.json` no longer excludes `"tests"` and `sqlalchemy.json` no longer excludes `"test"`; a startup warning fires when an `exclude` entry names a directory `is_test_file` would classify.
- [x] #5 Integration tests with fixture configs cover every evidence case: the celery `t/unit`, `t/smoke`, `t/integration` filename-marked shape, the django excluded-`tests` shape, the sqlalchemy `lib/sqlalchemy/testing/**` production-code shape, and the `include_tests: true` cross-script agreement.
- [x] #6 `detect_entrypoints.test.ts:59-160` is rewritten against the new file-set semantics and passes.
- [x] #7 A recorded measurement across celery, typeorm, prisma, django, angular and TypeScript reports entry-point count, wall-clock and cache-size deltas; prisma `compileFile` and celery `long_running_task` are absent from the entry-point sets and no new entry point comes from a test file.

<!-- AC:END -->

## Implementation Notes

### What a user gets

One scope decision, read once, in one place. `detect_entrypoints` and `prepare_triage` now index through a shared `src/analysis_scope.ts`; they used to each parse the project config and had already drifted — `prepare_triage` hard-coded `include_tests: false`, silently discarding a config that asked for `true`. A config now means the same thing to both scripts by construction.

The harness also stopped paying for work it already had: the second walk-and-re-read of the whole repository is gone, and the giant-file gate reads the project's own contents map — the bytes the resolver saw.

Two project configs stopped deleting call edges: `django--django.json` no longer excludes `tests`, `sqlalchemy.json` no longer excludes `test`. A config that names a test directory in `exclude` now warns at startup, saying why it costs edges and buys nothing.

### Measurement

Recorded across the epic's six target corpora. Invocation styles differ and that
matters for reading the table: django and sqlalchemy ran `--config`, prisma,
typeorm, celery and angular ran `--path` (whole repo, no config).

| project | invocation | files | entry points | wall clock | cache |
| --- | --- | --- | --- | --- | --- |
| celery | `--path` | 417 | 842 | — | — |
| prisma | `--path` | 2619 | 544 | 82s | — |
| typeorm | `--path` | 3343 | 656 | 135s | — |
| django | `--config` | 2994 | 2750 | 488s | 2.6 G |
| sqlalchemy | `--config` | 557 | 2747 | 307s | 1.9 G |
| angular | `--path` | 6226 | 5137 | 1383s (23 min) | 1.8 G |
| TypeScript | `--path` | — | — | OOM at 104 min | 4.3 G partial |
| TypeScript | `--config` (baselines excluded) | 19267 | 2324 | 3610s (60 min) | 4.3 G |

Before/after pairs, same project key and same repo commit:

| project | corpus | entry points | cache |
| --- | --- | --- | --- |
| django | 932 → 2994 files | 3093 → 2750 (−343) | 565 M → 2.6 G |
| sqlalchemy | 220 → 557 files | 3207 → 2747 (−460) | — → 1.9 G |
| celery (differently invoked) | 259 → 417 | 1093 → 842 (−251) | — |
| angular (differently invoked) | 3401 → 6226 | 4996 → 5137 (+141) | 632 M → 1.8 G |

**These deltas belong to the epic, not to this sub-task's config edit.** The
"before" runs predate three landed changes and cannot separate them: the
`file_filter` removal, the `should_ignore_path` anchoring, and the config edit
here. django proves the compounding — its after-run holds 121 entry points under
`django/template` and 23 under `django/templatetags` that the before-run has
none of, and those trees returned because `temp` stopped substring-matching
`django/template/**`, not because `tests` left the exclude list. sqlalchemy is
the same story: the unanchored `"test"` was also deleting
`lib/sqlalchemy/testing/**`, which the anchoring restores independently. The
work plan predicted this ("the two changes compound and the file-count delta
must be measured together"); the table reports the compound.

Corpus growth is the real cost, and it lands on the cache: django's index grew
4.6× and angular's 2.8×.

Rows this sub-task had to resolve, verified on the live pipeline:

- prisma `compileFile` — **absent** from the entry-point set.
- celery `long_running_task` — **absent**.
- No new entry point comes from a test file: across all seven runs, **zero**
  entry points sit in a file `is_test_file()` classifies as a test.

Celery does gain 38 entry points sited under `t/`: task-definition modules
(`t/integration/tasks.py` contributes 15, `t/smoke/operations/*.py` more) and
test-support modules (`t/unit/security/case.py`, `t/unit/tasks/unit_tasks.py`,
`t/unit/bin/proj/*`, `t/unit/contrib/proj/foo.py`). None is a test file by
Ariadne's definition — no `test_` prefix, no test-directory name — and their
callables are genuinely uncalled. They are new candidates honestly surfaced, not
suppressed candidates leaking through.

### The corpus that proved untenable

microsoft/TypeScript discovers 38,187 source files — what `find_source_files` actually admits, after gitignore and with `.d.ts` excluded. 18,439 of them are generated compiler baselines under `tests/baselines`; only 601 are `src/`. Indexing the lot exhausted the V8 heap after **104 minutes** (`FATAL ERROR: Ineffective mark-compacts near heap limit`), leaving a 4.0 G partial cache.

The task named the honest lever for this: a corpus cap with a loud warning, never a silent discovery filter. `LoadProjectOptions.max_files` implements it as a refusal rather than a truncation, defaulting to 20,000 for every invocation mode — a corpus missing arbitrary files reports callees whose callers were simply left out, which is the exact false-entry-point failure this epic removes, so continuing quietly would be worse than stopping. The error names the three remedies: scope with `folders`, exclude the generated tree, or raise the cap deliberately.

TypeScript's own remedy is a project config excluding `baselines` — generated output, in the same category as `dist` and `build`, and correctly *not* flagged by the test-tree warning. With it the run completes: 19,267 files, 2,324 entry points, 60 minutes. That lands just under the 20,000 default cap, which is the cap doing its job — one more generated tree and the run refuses instead of dying an hour in.

### Deviations from the work plan

1. **One walk is kept.** Step 2 asked for the second walk and re-read both to go. The re-read is gone. The walk stays, because it is the only source of the *discovered* set: the indexed/discovered ratio gate needs it as a denominator, and sub-task 1.2 keys the whole out-of-index grep on discovered-minus-indexed. Deleting it would remove the ability to see a coverage gap at all.
2. **The scope reader is shared rather than duplicated correctly.** Step 3 asked for `include_tests` to be added to `prepare_triage`'s own `IndexScopeFromConfig`. Two copies agreeing is a coincidence that drifts; one reader with two consumers is the agreement the step actually asks for ("agree by construction rather than by coincidence"). The shared module owns the corpus cap's default for the same reason — a ceiling one phase applies and the next does not is the same drift wearing a different hat.
3. **`max_files` was not in the plan.** It is step 8's stated contingency, triggered by the TypeScript result.

### Left to sub-task 1.2, deliberately

A config `exclude` is threaded into the out-of-index walk as well as into discovery, so an excluded caller is invisible to *both* passes — the compensation cannot compensate. `detect_entrypoints.test.ts` pins that behaviour today with a comment naming 1.2 as the change that flips it, so that sub-task gets a real failing-to-passing transition instead of a test that was already green.
