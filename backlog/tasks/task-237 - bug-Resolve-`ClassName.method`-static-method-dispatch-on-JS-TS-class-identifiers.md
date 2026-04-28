---
id: TASK-237
title: >-
  [bug] Resolve `ClassName.method()` static-method dispatch on JS/TS class
  identifiers
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - static-method-call-unresolved
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `static-method-call-unresolved`
**Observed count:** 8

`ClassName.staticMethod(...)` dispatch is not linked to the static-method definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
