---
id: TASK-230
title: >-
  [bug] Resolver does not track function values stored as object-literal /
  instance properties
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - object-property-function-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `object-property-function-dispatch`
**Observed count:** 10

Object literals or instance properties storing function values: when invoked via `obj.prop()` or `instance.prop()`, the function value is not tracked. Distinct from method dispatch — the property is explicitly a function value, not a method definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
