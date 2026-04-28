---
id: TASK-190.16.56
title: '[gap] Add definition-site signals for runtime accessor registration'
status: To Do
assignee: []
created_date: '2026-04-28 11:55'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - dynamic-getter-registration
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_line_regex`, `enclosing_call_name_eq`

Definition-site line regex plus the enclosing call's callee name (e.g. `Object.defineProperty`, `Reflect.defineProperty`).

Source: triage-curator sweep. Triggering group: dynamic-getter-registration.
<!-- SECTION:DESCRIPTION:END -->
