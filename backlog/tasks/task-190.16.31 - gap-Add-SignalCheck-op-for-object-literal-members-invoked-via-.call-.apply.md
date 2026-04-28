---
id: TASK-190.16.31
title: >-
  [gap] Add SignalCheck op for object-literal members invoked via
  .call()/.apply()
status: To Do
assignee: []
created_date: '2026-04-28 11:51'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - call-apply-indirect-invocation
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `enclosing-object-member-invoked-via-call-apply`

Object-literal members invoked via `.call(...)` / `.apply(...)` lose their enclosing-object identity. Need a signal that recognises this dispatch shape.

Source: triage-curator sweep. Triggering group: call-apply-indirect-invocation.
<!-- SECTION:DESCRIPTION:END -->
