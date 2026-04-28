---
id: TASK-190.16.66
title: '[gap] Add enclosing-class implements + external-interface-origin signals'
status: To Do
assignee: []
created_date: '2026-04-28 11:56'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - external-framework-interface-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `enclosing-class-implements-matches`, `implemented-interface-is-external`

Detect classes that implement external (e.g. node_modules) interfaces; the entry's enclosing class implements an interface defined outside the project.

Source: triage-curator sweep. Triggering group: external-framework-interface-dispatch.
<!-- SECTION:DESCRIPTION:END -->
