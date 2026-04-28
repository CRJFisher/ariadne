---
id: TASK-333
title: '[bug] Trace inner named function expressions returned from factories'
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - closure-returned-function
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `closure-returned-function`. **Observed:** 1

`function make() { return function inner() {} }; const f = make(); f();` — track inner function through return.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
