---
id: TASK-263
title: '[bug] Resolve `this` inside prototype-object-property methods to method table'
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - this-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `this-method-dispatch`. **Observed:** 3

`Class.prototype.method = function() { this.<other>(); }` — bind `this` to the prototype's method table.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
