---
id: TASK-213
title: >-
  [bug] Resolve `this.<method>()` calls to sibling properties of the enclosing
  object literal
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - this-based-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `this-based-method-dispatch`
**Observed count:** 50

Inside a `key: function() { ... this.<sibling>(...) ... }` form, `this` is bound to the enclosing object literal at call time. Ariadne does not perform this binding, so calls to sibling property functions are unresolved. Particularly common in legacy JS object-namespace code (e.g. firebug-lite-debug.js in lodash).

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
