---
id: TASK-190.16.43
title: >-
  [gap] Add binding-property-name + string-literal-grep signals for string-keyed
  dispatch
status: To Do
assignee: []
created_date: '2026-04-28 11:53'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-string-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_binding_property_name`, `string_literal_value_grep`

Binds the property key from `propName: function()` and lets grep search for the bound name as a quoted string at structural dispatch keys.

Source: triage-curator sweep. Triggering group: dynamic-string-dispatch.
<!-- SECTION:DESCRIPTION:END -->
