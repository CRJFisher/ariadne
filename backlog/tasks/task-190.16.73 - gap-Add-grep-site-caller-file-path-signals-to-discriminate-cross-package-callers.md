---
id: TASK-190.16.73
title: >-
  [gap] Add grep-site caller-file-path signals to discriminate cross-package
  callers
status: To Do
assignee: []
created_date: '2026-04-28 11:57'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - cross-package-method-resolution
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `grep-site-file-path-matches`, `grep-site-file-imports-entry-via-package-specifier`

File-path matching for grep hits + a check that the calling file imports via npm-name specifier.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
