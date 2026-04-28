---
id: TASK-281
title: '[bug] Resolve method calls through TypeScript type casts (`<T>x` / `x as T`)'
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - type-cast-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `type-cast-dispatch`. **Observed:** 2

Type-cast expressions on the receiver should propagate the cast type to method lookup.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
