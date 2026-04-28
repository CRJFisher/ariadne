---
id: TASK-190.16.32
title: >-
  [gap] Add SignalCheck op: enclosing class has subclass whose constructor calls
  super()
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - super-constructor-call
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `enclosing-class-has-subclass-with-super-call`

To classify constructor methods that are reached only via `super()` from subclasses, classifiers need a signal that confirms a subclass exists and calls `super(...)`.

Source: triage-curator sweep. Triggering group: super-constructor-call.
<!-- SECTION:DESCRIPTION:END -->
