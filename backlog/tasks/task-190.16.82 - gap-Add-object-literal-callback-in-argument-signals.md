---
id: TASK-190.16.82
title: '[gap] Add object-literal-callback-in-argument signals'
status: To Do
assignee: []
created_date: '2026-04-28 11:58'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-property-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_is_object_literal_method`, `definition_is_object_literal_argument_callback`

Detect object-literal callbacks passed as call arguments (e.g. `fn({ onChange: () => {} })`).

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
