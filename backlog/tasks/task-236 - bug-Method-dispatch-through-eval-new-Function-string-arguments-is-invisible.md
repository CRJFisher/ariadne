---
id: TASK-236
title: >-
  [bug] Method dispatch through eval / new Function string arguments is
  invisible
status: To Do
assignee: []
created_date: '2026-04-28 12:03'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - eval-based-dynamic-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `other`
**Target registry entry:** `eval-based-dynamic-dispatch`
**Observed count:** 8

`eval(...)` / `new Function(...)` invocations construct callable strings at runtime. The resolver cannot model these as call edges; functions referenced only through eval-style dispatch appear unreachable.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
