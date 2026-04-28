---
id: TASK-190.16.77
title: '[gap] Add inheritance-aware signals for polymorphic base-method detection'
status: To Do
assignee: []
created_date: '2026-04-28 11:57'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - polymorphic-dispatch-missing-base-method
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `has_subclass_override`, `is_empty_method_body`, `extends_chain_captured`

Detect base-class methods that are overridden by subclasses (often empty or no-op). Signals discriminate polymorphic-base-method false positives.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
