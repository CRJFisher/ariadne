---
id: TASK-190.16.50
title: '[gap] Add definition-file content-scan SignalCheck op'
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - proxy-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition-file-content-regex`

Scans the entry's own source file for a regex match (e.g. detecting `new Proxy(...)` patterns elsewhere in the same file).

Source: triage-curator sweep. Triggering group: proxy-dispatch.
<!-- SECTION:DESCRIPTION:END -->
