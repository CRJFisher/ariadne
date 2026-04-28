---
id: TASK-327
title: >-
  [bug] Resolver fails `new X(...)` when `X` is `var`-bound named function
  expression
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - constructor-call-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `constructor-call-resolution`. **Observed:** 1

`var X = function X() { ... }; new X();` — link to the function expression.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
