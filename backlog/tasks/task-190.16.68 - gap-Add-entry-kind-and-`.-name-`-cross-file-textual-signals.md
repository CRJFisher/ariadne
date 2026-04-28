---
id: TASK-190.16.68
title: '[gap] Add entry-kind and `.<name>(` cross-file textual signals'
status: To Do
assignee: []
created_date: '2026-04-28 11:56'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - instance-method-call-unresolved
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `entry-kind-eq`, `name-occurs-in-dot-call-pattern`

Discriminate instance-method false positives via entry kind + a cross-file textual scan for `.<name>(` patterns.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
