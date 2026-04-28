---
id: TASK-324
title: >-
  [bug] Resolve static method calls on imported class identifiers
  (`ClassName.staticMethod()`)
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - static-method-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `static-method-resolution`. **Observed:** 1

`import { Foo } from './mod'; Foo.staticMethod()` — resolve through to the static-method definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
