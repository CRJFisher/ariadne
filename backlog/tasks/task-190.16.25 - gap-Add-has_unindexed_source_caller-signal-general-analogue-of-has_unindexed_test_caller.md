---
id: TASK-190.16.25
title: >-
  [gap] Add has_unindexed_source_caller signal (general analogue of
  has_unindexed_test_caller)
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - cross-file-import-resolution
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `has-unindexed-source-caller`, `second-pass-grep-over-unindexed-source-files`

A general analogue of the test-only `has_unindexed_test_caller` — for production source files outside the indexed scope (script directories, sandbox, helpers, examples). Currently Ariadne only does the second-pass grep for test directories.

Proposed:
- A second-pass grep over arbitrary unindexed source directories (script dirs, sandbox, helpers, examples)
- A `has_unindexed_source_caller` signal for classifiers to gate on "callers exist outside indexed scope but not in tests"

Source: triage-curator sweep. Triggering groups: cross-file-import-resolution (angular), unindexed-script-caller (prisma).
<!-- SECTION:DESCRIPTION:END -->
