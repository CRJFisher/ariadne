---
id: TASK-190.16.111
title: >-
  [gap] Detect callers in unindexed internal folders (generalises
  TASK-190.16.17)
status: To Do
assignee: []
created_date: '2026-04-28 12:01'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - unindexed-caller-files
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `has-callers-in-unindexed-folder`, `grep-hit-outside-indexed-scope`, `grep-hit-inside-comment`

Generalises the test-file pass to arbitrary unindexed folders + filters comment-only grep hits.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
