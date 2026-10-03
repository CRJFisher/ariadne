---
id: TASK-376.22
title: >-
  Search a package's declared source root, not just its ancestors, when
  resolving absolute Python imports
status: To Do
assignee: []
created_date: '2026-09-17 20:29'
labels:
  - plan-export
  - name_resolution
dependencies:
  - TASK-376.12
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

`resolve_absolute_python` searches the importing file's ancestor directories and its topmost package's parent for an absolute import's root. It never considers a src-layout package root — a directory such as `lib/` (or `src/`) that holds the importable package but is not itself an ancestor of the importing file and is not the repository root.

sqlalchemy ships its package at `lib/sqlalchemy`, with `test/` as a sibling of `lib/`, not a descendant. Every `from sqlalchemy import …` under `test/` fails `name_not_in_scope` — `test/dialect/mysql/test_types.py`'s `mysql.FLOAT()`, `sqltypes.Float()`, `eq_()` and `Column()` all fail this way, not just the one row surfaced by TASK-376.12's evidence. Measured on TASK-376.12's candidate tree (`fc26d312`): `mysql.FLOAT()` at `test/dialect/mysql/test_types.py:469` is `name_not_in_scope`, entry point, unchanged from the epic's starting tree (`279221d4`) and control (`f0f3d7f9`).

This is import-root discovery, not member lookup or binding — outside every ladder rung TASK-376 otherwise touches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Absolute Python imports resolve against a project's declared source root(s) — e.g. a setup.cfg/pyproject.toml package_dir or a conventional src/ or lib/ layout — in addition to the existing ancestor and topmost-package-parent search.
  Evidence: `resolve_absolute_python` (`import_resolution.python.ts`) searches, in `sys.path` order, the importing file's directory, the project root (the parent of the topmost `__init__.py` package), then `src/` and `lib/` under the project root (`SOURCE_ROOT_DIRECTORIES`, a closed list so a test tree or vendored copy cannot claim an import), then the three directories above the project root. The conventional layouts are the covered case; a `package_dir` declared in `setup.cfg`/`pyproject.toml` is not read, and no corpus shape here needed it. Pinned by `import_resolution.python.test.ts` › "a project's declared source root": lib/ from a sibling test tree, a dotted submodule under lib/, src/, the project root winning over a same-named `lib/` package, and a name the source root does not hold claiming nothing. The three positive cases fail with `SOURCE_ROOT_DIRECTORIES` emptied and pass with it.
- [x] #2 sqlalchemy's lib/sqlalchemy layout is added as a fixture: test/dialect/mysql/test_types.py's mysql.FLOAT(), sqltypes.Float(), eq_() and Column() all resolve.
  Evidence: fixture `packages/core/tests/fixtures/python/code/integration/src_layout_package/` (`lib/sqlalchemy/` with `dialects/mysql/base.py`, `types.py`, `testing/`, beside `test/dialect/mysql/test_types.py`), read by `project.corpus_evidence.integration.test.ts` › "sqlalchemy: a test tree reaches the package its project installs from lib/", which asserts `FLOAT` → `base.py:FLOAT`, `Float` → `types.py:Float`, `Column` → `__init__.py:__init__` and `eq_` → `__init__.py:eq_` with `toEqual`; it fails with the source-root search emptied. On the real corpus (sqlalchemy `aa1a5575`, below), `test/dialect/mysql/test_types.py` carries unresolved call references for `FLOAT` 2 → 0, `Float` 1 → 0, `eq_` 60 → 0 and `Column` 80 → 0, and `mysql.FLOAT()` at line 469, `name_not_in_scope` on the control arm, is absent from the candidate's unresolved set.
- [x] #3 A project with no declared source root (the common case) is unaffected: the existing ancestor and topmost-package-parent search still runs unchanged.
  Evidence: the source-root step sits after the local-directory and project-root steps and before the above-root climb, so it is reached only when both earlier roots missed; nothing earlier changed. `import_resolution.python.test.ts` › "leaves a project with no source root to the search it already had" and › "yields to the project root" pin it, and every pre-existing case in that file passes unmodified. `cd packages/core && npx tsc --noEmit` is clean and `npx vitest run` passes 234 files, 5,363 tests (1 todo). MEASURED over sqlalchemy `aa1a5575` (`repository-root-excluding:examples,tools`, 583 files, 583 indexed, 0 dropped), control and candidate interleaved A,B,A,B in one session by `run_load_benchmark.ts --interleave`, control being this tree with `SOURCE_ROOT_DIRECTORIES` emptied in a throwaway worktree (the harness therefore labels both arms `ariadne@5de273e3`, and its noise-floor note is that artefact; the fingerprints differ, so the arms are not the same tree): call references 188,836 → 189,240; resolved 33,653 → 117,038 (+83,385); `name_not_in_scope` 106,884 → 39,463 (−67,421); `receiver_type_unknown` 31,608 → 20,017; `method_not_on_type` 14,647 → 10,062; `member_type_unknown` 1,687 → 2,363 (+676, calls that now reach a receiver and fail there); raw entry points 3,943 → 3,614 (329 removed, none added); call edges 27,743 → 81,477, with 844 control-only edges whose targets are parameters, classes and variables (for example `assert_warns` → `callable_`, `go` → `A` in `test_memusage.py`); those were not investigated here. CPU 233.05 s control against 231.15 s candidate, 1.01x.
<!-- AC:END -->
