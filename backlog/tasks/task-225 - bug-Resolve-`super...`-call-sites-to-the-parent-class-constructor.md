---
id: TASK-225
title: '[bug] Resolve `super(...)` call sites to the parent class constructor'
status: To Do
assignee: []
created_date: '2026-04-28 09:40'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - super-constructor-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `super-constructor-call`
**Observed count:** 11

`super(...)` call sites inside subclass constructors are not linked to the parent class's constructor definition. Reference extraction does not emit the synthetic call edge.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
