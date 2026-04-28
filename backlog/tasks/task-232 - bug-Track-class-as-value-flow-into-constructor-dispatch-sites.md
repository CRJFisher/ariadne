---
id: TASK-232
title: '[bug] Track class-as-value flow into constructor-dispatch sites'
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-constructor-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `dynamic-constructor-dispatch`
**Observed count:** 10

When a class is passed as a value to a function and then `new` is invoked on it (`function makeInstance(C, ...args) { return new C(...args); }`), the class identity flow is lost.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
