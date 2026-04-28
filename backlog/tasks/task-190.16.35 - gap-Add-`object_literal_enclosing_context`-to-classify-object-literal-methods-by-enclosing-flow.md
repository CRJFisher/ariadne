---
id: TASK-190.16.35
title: >-
  [gap] Add `object_literal_enclosing_context` to classify object-literal
  methods by enclosing flow
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - method-on-returned-object
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_is_object_literal_method`, `object_literal_enclosing_context`

The existing `definition_is_object_literal_method` flag does not surface the enclosing context (returned from function, assigned to property, passed as argument). Adding an `object_literal_enclosing_context` enum lets classifiers discriminate these flows.

Source: triage-curator sweep. Triggering group: method-on-returned-object.
<!-- SECTION:DESCRIPTION:END -->
