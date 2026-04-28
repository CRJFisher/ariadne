---
id: TASK-318
title: >-
  [bug] Resolve method calls through TS `as` casts to anonymous structural
  object types
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-cast-structural-type-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dynamic-cast-structural-type-dispatch`. **Observed:** 1

`(x as { foo: () => void }).foo()` — propagate the structural type to method lookup.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
