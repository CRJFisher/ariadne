---
id: TASK-190.16.40
title: >-
  [gap] Add accessor-definition flag to FalsePositiveEntry for JS/TS
  getter/setter detection
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - getter-property-access
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `accessor-definition-flag`

`FalsePositiveEntry` lacks a clear accessor-definition flag. The existing `accessor_kind_eq` op only fires for JS/TS but the underlying flag is not always populated. Make it explicit and reliable.

Source: triage-curator sweep. Triggering group: getter-property-access.
<!-- SECTION:DESCRIPTION:END -->
