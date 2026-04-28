---
id: TASK-214
title: >-
  [bug] Resolve method dispatch through `X.prototype = { method: function() {}
  }` (JS)
status: To Do
assignee: []
created_date: '2026-04-28 09:38'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - prototype-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `prototype-dispatch`
**Observed count:** 50

ES5 prototype-attached object-literal methods unreachable. After `X.prototype = { m: function() {} }`, `instance.m()` calls do not link to the function definition. Distinct from the typed-class-field receiver-resolution shape (TASK-205) — this is JS prototype assignment specifically.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
