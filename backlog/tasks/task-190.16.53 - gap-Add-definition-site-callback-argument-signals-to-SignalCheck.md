---
id: TASK-190.16.53
title: '[gap] Add definition-site callback-argument signals to SignalCheck'
status: To Do
assignee: []
created_date: '2026-04-28 11:55'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - builtin-higher-order-callback
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-is-callback-argument`, `definition-enclosing-call-callee-name`

Definition-site signals for inline callbacks passed to higher-order calls (Array methods, etc.). Includes the enclosing call's callee name.

Source: triage-curator sweep. Triggering group: builtin-higher-order-callback.
<!-- SECTION:DESCRIPTION:END -->
