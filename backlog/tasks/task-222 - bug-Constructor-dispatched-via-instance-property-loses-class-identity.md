---
id: TASK-222
title: '[bug] Constructor dispatched via instance property loses class identity'
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-dispatch-reporter-constructor
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `dynamic-dispatch-reporter-constructor`
**Observed count:** 12

`new this._reporter(...)` style — the constructor is stored as an instance property and dispatched via `new <prop>(...)`. The class identity is lost across the property hop.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
