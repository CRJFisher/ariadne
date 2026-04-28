---
id: TASK-212
title: >-
  [bug] Resolve callers of functions stored in string-keyed dispatch maps
  invoked via `new Function(...)`
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - string-keyed-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `string-keyed-dispatch`
**Observed count:** 64

Eval-style dispatch via `new Function(...)` constructed at runtime from a key into a string-keyed function map. The callee identity is lost across the literal-string flow into `this[cmd]`. Source: lodash run.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
