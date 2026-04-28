---
id: TASK-339
title: >-
  [bug] Class assigned to instance property loses identity across `new
  this.<field>(...)`
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-instantiation-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `dynamic-instantiation-dispatch`. **Observed:** 0

`this.cls = SomeClass; new this.cls()` — track class identity through field write.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
