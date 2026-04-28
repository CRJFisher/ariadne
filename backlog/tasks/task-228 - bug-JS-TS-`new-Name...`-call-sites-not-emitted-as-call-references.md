---
id: TASK-228
title: '[bug] JS/TS `new Name(...)` call sites not emitted as call references'
status: To Do
assignee: []
created_date: '2026-04-28 09:40'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - constructor-new-expression
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `constructor-new-expression`
**Observed count:** 10

The `.scm` query for JS/TS does not capture `new Name(...)` expressions as `@reference.constructor`. As a result, all classes appear as having zero callers even when widely instantiated.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
