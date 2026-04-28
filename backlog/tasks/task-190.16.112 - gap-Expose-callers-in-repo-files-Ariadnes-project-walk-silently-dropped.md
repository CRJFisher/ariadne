---
id: TASK-190.16.112
title: '[gap] Expose callers in repo files Ariadne''s project walk silently dropped'
status: To Do
assignee: []
created_date: '2026-04-28 12:01'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - import-resolution-miss
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `grep-call-sites-unindexed-files`, `has-unindexed-file-caller`

Detect intra-package coverage holes: files in the indexed root that didn't make it into the project walk.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
