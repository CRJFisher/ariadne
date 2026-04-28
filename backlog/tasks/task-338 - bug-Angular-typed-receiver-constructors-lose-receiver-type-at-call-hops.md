---
id: TASK-338
title: '[bug] Angular typed-receiver constructors lose receiver type at call hops'
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - angular-di-template-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `angular-di-template-dispatch`. **Observed:** 0

`inject<T>()`, `viewChild<T>()`, `input<T>()`, `output<T>()` — Angular DI/template constructors return generic-typed values; receiver type lost at subsequent method dispatch.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
