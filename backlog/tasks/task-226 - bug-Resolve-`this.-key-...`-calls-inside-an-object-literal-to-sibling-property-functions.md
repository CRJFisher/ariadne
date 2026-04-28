---
id: TASK-226
title: >-
  [bug] Resolve `this.<key>(...)` calls inside an object literal to sibling
  property functions
status: To Do
assignee: []
created_date: '2026-04-28 09:40'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - this-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `this-method-dispatch`
**Observed count:** 11

Inside `propA: function() { this.<propB>(...) }` of an object literal, `this` is bound to the literal at call time. Resolver does not perform this binding. Sibling of TASK-213 — slightly different shape (`this-method-dispatch` vs `this-based-method-dispatch`).

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
