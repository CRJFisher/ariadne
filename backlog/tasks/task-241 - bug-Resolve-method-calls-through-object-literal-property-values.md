---
id: TASK-241
title: '[bug] Resolve method calls through object-literal property values'
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - anonymous-function-in-object-or-chain
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `anonymous-function-in-object-or-chain`
**Observed count:** 7

Anonymous arrows / function expressions stored as object-literal property values are unreachable through `obj.prop()` invocations.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
