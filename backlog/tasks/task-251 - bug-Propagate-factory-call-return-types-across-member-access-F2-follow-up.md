---
id: TASK-251
title: '[bug] Propagate factory-call return types across member access (F2 follow-up)'
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - factory-return-value-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `factory-return-value-dispatch`. **Observed:** 4

`makeFoo().method()` style — propagate the factory's return type through member access.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
