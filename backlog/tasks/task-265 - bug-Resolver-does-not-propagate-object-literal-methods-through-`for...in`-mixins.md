---
id: TASK-265
title: >-
  [bug] Resolver does not propagate object-literal methods through `for...in`
  mixins
status: To Do
assignee: []
created_date: '2026-04-28 12:07'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - mixin-extend-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `mixin-extend-dispatch`. **Observed:** 3

`function extend(t, s) { for (k in s) t[k] = s[k]; }` — the resolver doesn't track the function-value flow from source to target through property-copy.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
