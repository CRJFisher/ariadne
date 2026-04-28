---
id: TASK-229
title: >-
  [bug] Resolve `new ClassName(...)` reference.constructor captures to the
  class's constructor
status: To Do
assignee: []
created_date: '2026-04-28 09:40'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - constructor-new-expression
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `constructor-new-expression`
**Observed count:** 10

Even after the syntactic extraction is fixed (TASK-228), the resolver must link `@reference.constructor` captures to the class's constructor definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
