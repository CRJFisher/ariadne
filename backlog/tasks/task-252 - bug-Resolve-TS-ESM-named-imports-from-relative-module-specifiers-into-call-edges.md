---
id: TASK-252
title: >-
  [bug] Resolve TS ESM named imports from relative module specifiers into call
  edges
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - unresolved-import-caller
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `unresolved-import-caller`. **Observed:** 4

`import { x } from './mod'` — call edges from `x()` should link to the definition in `./mod`. Currently fails for some relative-specifier patterns.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
