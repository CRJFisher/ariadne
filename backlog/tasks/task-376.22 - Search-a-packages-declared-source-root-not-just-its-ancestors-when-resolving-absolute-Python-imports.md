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
- [ ] #1 Absolute Python imports resolve against a project's declared source root(s) — e.g. a setup.cfg/pyproject.toml package_dir or a conventional src/ or lib/ layout — in addition to the existing ancestor and topmost-package-parent search.
- [ ] #2 sqlalchemy's lib/sqlalchemy layout is added as a fixture: test/dialect/mysql/test_types.py's mysql.FLOAT(), sqltypes.Float(), eq_() and Column() all resolve.
- [ ] #3 A project with no declared source root (the common case) is unaffected: the existing ancestor and topmost-package-parent search still runs unchanged.
<!-- AC:END -->
