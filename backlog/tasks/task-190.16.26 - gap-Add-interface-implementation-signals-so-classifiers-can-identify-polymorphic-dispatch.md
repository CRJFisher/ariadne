---
id: TASK-190.16.26
title: >-
  [gap] Add interface-implementation signals so classifiers can identify
  polymorphic dispatch
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - interface-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-feature-implements-interface-method`, `call-ref-receiver-type-is-interface`

Classifiers cannot identify polymorphic dispatch through interface-typed receivers. Need a definition-side flag that marks methods implementing an interface, and a call-ref-side check that surfaces interface-typed receiver inference.

Source: triage-curator sweep. Triggering groups: interface-dispatch (typeorm), polymorphic-subtype-dispatch.
<!-- SECTION:DESCRIPTION:END -->
