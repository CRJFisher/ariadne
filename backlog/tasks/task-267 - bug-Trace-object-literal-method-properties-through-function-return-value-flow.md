---
id: TASK-267
title: >-
  [bug] Trace object-literal method properties through function-return value
  flow
status: To Do
assignee: []
created_date: '2026-04-28 12:07'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - method-on-returned-object
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `method-on-returned-object`. **Observed:** 3

`function make() { return { method: () => {} }; } make().method();` — propagate the object literal's methods through the return value flow.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
