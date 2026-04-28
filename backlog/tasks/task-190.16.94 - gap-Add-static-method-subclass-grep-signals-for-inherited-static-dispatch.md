---
id: TASK-190.16.94
title: '[gap] Add static-method + subclass-grep signals for inherited static dispatch'
status: To Do
assignee: []
created_date: '2026-04-28 11:59'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - inherited-static-method-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-is-static-method`, `subclass-call-site-grep`

Detect `Subclass.staticMethod(...)` callers where staticMethod is defined on the parent class.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
