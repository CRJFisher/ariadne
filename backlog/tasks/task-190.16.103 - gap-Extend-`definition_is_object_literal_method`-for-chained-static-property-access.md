---
id: TASK-190.16.103
title: >-
  [gap] Extend `definition_is_object_literal_method` for chained
  static-property-access
status: To Do
assignee: []
created_date: '2026-04-28 12:00'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - object-property-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition_is_object_literal_method`

Extend the existing flag to cover methods reached via chained static-property-access (`X.Y.Z.method`).

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
