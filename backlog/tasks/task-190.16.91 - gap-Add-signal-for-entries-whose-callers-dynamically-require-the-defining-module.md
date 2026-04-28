---
id: TASK-190.16.91
title: >-
  [gap] Add signal for entries whose callers dynamically require the defining
  module
status: To Do
assignee: []
created_date: '2026-04-28 11:59'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-require-resolution
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `caller-uses-dynamic-require-for-entry-module`, `receiver-bound-to-dynamic-require-destructure`

Discriminate dynamic-require false positives by detecting `require()` patterns at call sites.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
