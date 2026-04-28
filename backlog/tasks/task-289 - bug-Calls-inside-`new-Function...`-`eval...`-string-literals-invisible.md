---
id: TASK-289
title: '[bug] Calls inside `new Function(...)` / `eval(...)` string literals invisible'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - dynamic-new-function-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `other`. **Target:** `dynamic-new-function-dispatch`. **Observed:** 1

Sibling of TASK-236. Specifically about `new Function(stringSrc)` patterns.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
