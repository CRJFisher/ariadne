---
id: TASK-310
title: >-
  [bug] Resolve `this`-rooted calls inside prototype-object-property methods
  through field access
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dynamic-method-dispatch`. **Observed:** 1

`Class.prototype.method = function() { this.field.X(); }` where field type flows through.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
