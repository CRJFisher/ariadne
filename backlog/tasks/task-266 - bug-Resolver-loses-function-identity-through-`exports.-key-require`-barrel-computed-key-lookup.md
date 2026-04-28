---
id: TASK-266
title: >-
  [bug] Resolver loses function identity through `exports.<key> = require()`
  barrel + computed-key lookup
status: To Do
assignee: []
created_date: '2026-04-28 12:07'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-string-key-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `dynamic-string-key-dispatch`. **Observed:** 3

`exports.<key> = require('./file')` followed by `target[runtime_key]()` — function identity is lost.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
