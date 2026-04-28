---
id: TASK-235
title: '[bug] Resolve intra-file calls to named function expressions assigned to `var`'
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - intra-file-call-not-in-registry
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `intra-file-call-not-in-registry`
**Observed count:** 9

`var X = function X() { ... }` — Ariadne does not bind `X` to the function value, so intra-file calls to `X()` from sibling functions are unresolved.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
