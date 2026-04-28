---
id: TASK-280
title: '[bug] Resolve method calls on values returned from a JavaScript Proxy wrapper'
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - proxy-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `proxy-dispatch`. **Observed:** 2

`new Proxy(target, handler)` returns a value whose method dispatch is mediated by the handler. Need to model the dispatch path.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
