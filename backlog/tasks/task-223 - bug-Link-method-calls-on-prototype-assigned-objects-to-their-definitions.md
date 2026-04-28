---
id: TASK-223
title: '[bug] Link method calls on prototype-assigned objects to their definitions'
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - prototype-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `prototype-method-dispatch`
**Observed count:** 12

Both `obj.m = function() {}` and `Class.prototype.m = function() {}` assignment patterns: the call site `instance.m()` does not link to the function definition. Sibling of TASK-214/TASK-217 — same target.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
