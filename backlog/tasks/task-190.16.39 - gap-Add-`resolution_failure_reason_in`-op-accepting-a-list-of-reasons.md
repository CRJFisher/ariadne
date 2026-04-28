---
id: TASK-190.16.39
title: '[gap] Add `resolution_failure_reason_in` op accepting a list of reasons'
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - unresolved-receiver-type
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `resolution-failure-reason-in`

The existing `resolution_failure_reason_eq` accepts only one value. A list-form allows classifiers to match a closed set of reasons in a single check.

Source: triage-curator sweep. Triggering group: unresolved-receiver-type.
<!-- SECTION:DESCRIPTION:END -->
