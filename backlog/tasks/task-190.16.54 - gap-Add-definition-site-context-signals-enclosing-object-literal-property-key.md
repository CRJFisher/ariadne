---
id: TASK-190.16.54
title: >-
  [gap] Add definition-site context signals (enclosing object-literal /
  property-key)
status: To Do
assignee: []
created_date: '2026-04-28 11:55'
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
**Signals needed:** `definition_context_kind`, `definition_context_parent_regex`

Expose the syntactic kind of the enclosing context (object literal, class body, function call) plus a regex over the immediate parent expression.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
