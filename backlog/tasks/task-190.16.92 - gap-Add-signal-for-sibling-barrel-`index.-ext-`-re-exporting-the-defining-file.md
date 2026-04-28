---
id: TASK-190.16.92
title: >-
  [gap] Add signal for sibling barrel `index.<ext>` re-exporting the defining
  file
status: To Do
assignee: []
created_date: '2026-04-28 11:59'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-string-key-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `sibling-barrel-reexports-basename`, `grep_line_regex_cross_file`

Detects `require('./<basename>')` in a sibling `index.<ext>` file.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
