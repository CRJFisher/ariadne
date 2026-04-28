---
id: TASK-216
title: >-
  [bug] Resolve property-access calls on object literals to the function
  expression at the property key
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - object-literal-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `object-literal-method-dispatch`
**Observed count:** 23

Receiver-side resolution missing for `obj.method()` where `obj` is a let/const/var assigned an object literal `{ method: function() {} }`. The function value is reachable but the property access is not linked to it.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
