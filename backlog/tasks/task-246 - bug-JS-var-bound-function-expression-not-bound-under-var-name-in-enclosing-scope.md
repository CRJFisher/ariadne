---
id: TASK-246
title: >-
  [bug] JS var-bound function expression not bound under var name in enclosing
  scope
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - same-file-var-function-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `same-file-var-function-resolution`. **Observed:** 5

`var X = function() { ... }` — the function value is not bound to `X` in the enclosing scope, so intra-file calls to `X()` fail to resolve.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
