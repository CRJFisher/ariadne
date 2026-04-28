---
id: TASK-190.16.98
title: >-
  [gap] Detect legacy `key: function(...)` object-literal methods + `extend()`
  mixin sites
status: To Do
assignee: []
created_date: '2026-04-28 11:59'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - mixin-extend-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_is_object_literal_method_legacy_form`, `enclosing_object_passed_to_mixin_utility`

Discriminate mixin-extend dispatch: legacy object-literal methods passed to `extend(...)`/`mixin(...)`/`Object.assign(...)` utilities.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
