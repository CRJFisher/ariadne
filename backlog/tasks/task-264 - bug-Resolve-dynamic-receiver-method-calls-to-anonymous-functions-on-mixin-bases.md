---
id: TASK-264
title: >-
  [bug] Resolve dynamic-receiver method calls to anonymous functions on mixin
  bases
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - polymorphic-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `polymorphic-method-dispatch`. **Observed:** 3

`arr[i].m()`, `param.m()` patterns where receiver is bound through mixin assignment to an object-literal method base.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
