---
id: TASK-253
title: >-
  [bug] Resolve `this.method()` / `obj.method()` to anonymous functions in
  object-literal properties
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-receiver-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dynamic-receiver-method-call`. **Observed:** 4

When the receiver is bound to an object literal `{ method: function(){...} }`, member calls should resolve to the function value.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
