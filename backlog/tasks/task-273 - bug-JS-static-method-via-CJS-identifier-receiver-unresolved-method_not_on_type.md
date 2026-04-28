---
id: TASK-273
title: >-
  [bug] JS static method via CJS identifier receiver unresolved
  (method_not_on_type)
status: To Do
assignee: []
created_date: '2026-04-28 12:08'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - static-method-on-cjs-class
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `static-method-on-cjs-class`. **Observed:** 2

`const X = require('./X'); X.staticMethod(...)` — receiver is a CJS module-bound class identifier; method lookup fails with `method_not_on_type`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
