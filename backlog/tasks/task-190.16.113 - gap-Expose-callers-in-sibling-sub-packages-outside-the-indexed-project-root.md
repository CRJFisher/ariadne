---
id: TASK-190.16.113
title: '[gap] Expose callers in sibling sub-packages outside the indexed project root'
status: To Do
assignee: []
created_date: '2026-04-28 12:01'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - cross-package-call
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `grep-call-sites-unindexed-packages`, `has-unindexed-package-caller`

Detect callers in sibling sub-packages that the project walk excluded.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
