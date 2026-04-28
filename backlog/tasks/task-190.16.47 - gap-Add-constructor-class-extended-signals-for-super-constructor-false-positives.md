---
id: TASK-190.16.47
title: >-
  [gap] Add constructor + class-extended signals for super-constructor false
  positives
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
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
**Signals needed:** `definition_is_constructor`, `enclosing_class_is_extended_in_project`

Two definition-side flags so super-constructor classifiers can scope to constructor methods on classes that have at least one subclass.

Source: triage-curator sweep. Triggering group: super-constructor-call.
<!-- SECTION:DESCRIPTION:END -->
