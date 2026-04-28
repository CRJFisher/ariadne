---
id: TASK-190.16.71
title: >-
  [gap] Add file-scoped signal for eval/new-Function strings referencing entry
  name
status: To Do
assignee: []
created_date: '2026-04-28 11:57'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - eval-based-dynamic-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `file_contains_eval_or_function_string_referencing_name`

Detects entries reachable via eval-based dynamic dispatch by scanning the entry's file for `eval(...)`/`new Function(...)` literals containing the entry name.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
