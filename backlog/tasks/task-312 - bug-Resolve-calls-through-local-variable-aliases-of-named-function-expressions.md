---
id: TASK-312
title: >-
  [bug] Resolve calls through local variable aliases of named function
  expressions
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - local-variable-alias
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `local-variable-alias`. **Observed:** 1

`var X = FBL.Y` — track the alias and resolve calls to `X(...)` to the source.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
