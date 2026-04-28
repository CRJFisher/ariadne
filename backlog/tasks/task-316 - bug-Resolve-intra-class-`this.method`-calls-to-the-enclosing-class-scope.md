---
id: TASK-316
title: '[bug] Resolve intra-class `this.method()` calls to the enclosing class scope'
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - intra-class-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `intra-class-method-call`. **Observed:** 1

`this.method()` inside a class body should resolve to the enclosing class's same-named method.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
