---
id: TASK-274
title: >-
  [bug] JS/TS resolver cannot link string-keyed `obj[key]()` to the property's
  function value
status: To Do
assignee: []
created_date: '2026-04-28 12:08'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-string-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `dynamic-string-dispatch`. **Observed:** 2

`obj[stringKey]()` — when key is a string literal, the resolver should bind to `obj.<stringKey>` and resolve the method.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
