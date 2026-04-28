---
id: TASK-239
title: '[bug] Model `Foo.member.call/apply(...)` as a call edge to the bound function'
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - call-apply-indirect-invocation
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `call-apply-indirect-invocation`
**Observed count:** 7

`Foo.member.call(thisArg, args)` and `.apply(thisArg, args)` are not modelled as call edges to the function bound at `Foo.member`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
