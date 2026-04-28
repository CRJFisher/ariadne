---
id: TASK-305
title: '[bug] Propagate declared field type across object-destructuring bindings'
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - destructured-property-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `destructured-property-method-call`. **Observed:** 1

`const { method } = obj;` followed by `method()` — propagate the field's declared type through the destructure.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
