---
id: TASK-190.16.34
title: '[gap] Add `definition_is_inline_callback_argument` syntactic feature'
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - callback-registration
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition-is-inline-callback-argument`

Inline arrow functions and function expressions passed directly as call arguments (`fn(arg, () => { ... })`) need a definition-side flag for classifiers to target this pattern.

Source: triage-curator sweep. Triggering groups: callback-registration, event-emitter-callback.
<!-- SECTION:DESCRIPTION:END -->
