---
id: TASK-190.16.90
title: '[gap] Add signal for destructured CommonJS require binding the entry''s name'
status: To Do
assignee: []
created_date: '2026-04-28 11:58'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - destructured-commonjs-require
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `file_contains_destructured_require_of_name`

A file-level signal that fires when a caller file contains `const { entryName } = require(...)`.

Source: triage-curator sweep. Triggering group: destructured-commonjs-require.
<!-- SECTION:DESCRIPTION:END -->
