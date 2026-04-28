---
id: TASK-190.16.46
title: >-
  [gap] Add class-hierarchy and override-detection signals for
  polymorphic-dispatch classifiers
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - polymorphic-method-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-is-subclass-override`, `name-has-sibling-definitions-in-base-or-siblings`, `property-access-no-call-paren`

Class-hierarchy override detection requires three signals to discriminate polymorphic dispatch from arbitrary 0-caller methods.

Source: triage-curator sweep. Triggering group: polymorphic-method-dispatch.
<!-- SECTION:DESCRIPTION:END -->
