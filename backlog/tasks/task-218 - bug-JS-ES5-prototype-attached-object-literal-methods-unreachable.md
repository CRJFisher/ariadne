---
id: TASK-218
title: '[bug] JS ES5 prototype-attached object-literal methods unreachable'
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
**Observed count:** 18

Receiver type lost across `Class.prototype = { m: function() {} }` then `instance.m()`. Variant of TASK-214 specifically scoped to prototype assignment with object literal of legacy property functions.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
