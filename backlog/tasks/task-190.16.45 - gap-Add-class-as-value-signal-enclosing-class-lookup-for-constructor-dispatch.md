---
id: TASK-190.16.45
title: >-
  [gap] Add class-as-value signal + enclosing-class lookup for constructor
  dispatch
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-constructor-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `class_referenced_as_value`, `enclosing_class_name`

Tracks classes used as runtime values (passed to functions) plus exposes the enclosing class name at the entry's location.

Source: triage-curator sweep. Triggering group: dynamic-constructor-dispatch.
<!-- SECTION:DESCRIPTION:END -->
