---
id: TASK-190.16.63
title: '[gap] Add enclosing-class decorator + Angular template-binding signals'
status: To Do
assignee: []
created_date: '2026-04-28 11:56'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - angular-framework-lifecycle-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `enclosing-class-decorator-matches`, `method-bound-by-angular-template`

Walks up to the enclosing class decorator block + scans sibling `.html` templates for `(event)="method(...)"` bindings.

Source: triage-curator sweep. Triggering group: angular-framework-lifecycle-dispatch.
<!-- SECTION:DESCRIPTION:END -->
