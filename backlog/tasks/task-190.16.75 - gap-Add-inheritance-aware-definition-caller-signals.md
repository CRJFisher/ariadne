---
id: TASK-190.16.75
title: '[gap] Add inheritance-aware definition + caller signals'
status: To Do
assignee: []
created_date: '2026-04-28 11:57'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - inherited-method-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-class-has-subclasses`, `callers-on-subclass-receiver`

Discriminate inherited-method dispatch by detecting subclasses of the entry's enclosing class and confirming callers exist on subclass receivers.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
