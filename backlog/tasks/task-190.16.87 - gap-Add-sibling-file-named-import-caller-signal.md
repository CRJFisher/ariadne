---
id: TASK-190.16.87
title: '[gap] Add sibling-file named-import-caller signal'
status: To Do
assignee: []
created_date: '2026-04-28 11:58'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - unresolved-import-caller
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `has_named_import_caller_in_sibling_file`

A check that confirms callers exist in a sibling file via named-import resolution. Useful for TS ESM same-directory relative imports.

Source: triage-curator sweep. Triggering group: unresolved-import-caller.
<!-- SECTION:DESCRIPTION:END -->
