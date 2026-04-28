---
id: TASK-190.16.30
title: >-
  [gap] Add SignalCheck op for detecting that a function is referenced as a
  callback argument
status: To Do
assignee: []
created_date: '2026-04-28 09:35'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - callback-registration
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `name-appears-as-call-argument-in-codebase`, `name-assigned-to-property-then-passed-as-argument`

Functions referenced by-name as callback arguments (`registerHandler(myFunc)`, `arr.map(myFunc)`) cannot be classified. Available grep ops require regex content match but no op confirms that the entry's name appears as a *call argument* anywhere.

Proposed signals expose the by-name argument-passing pattern.

Source: triage-curator sweep. Triggering groups: callback-registration (jquery, angular, lodash, typeorm, prisma; high observed_count).
<!-- SECTION:DESCRIPTION:END -->
