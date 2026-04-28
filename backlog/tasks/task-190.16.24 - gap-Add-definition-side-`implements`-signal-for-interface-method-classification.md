---
id: TASK-190.16.24
title: >-
  [gap] Add definition-side `implements` signal for interface-method
  classification
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - interface-method-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition_implements_interface`, `definition_overrides_interface_method`

TypeScript classes that explicitly `implements <Interface>` and override an interface-declared method cannot be classified — there is no SignalCheck op exposing the implements clause or the implements-method relationship.

Proposed:
- `definition_implements_interface`: entry's enclosing class declares `implements <Interface>` for any interface
- `definition_overrides_interface_method`: entry's name is declared on an implemented interface

Source: triage-curator sweep. Triggering groups: interface-polymorphic-dispatch (angular), interface-method-dispatch (typeorm).
<!-- SECTION:DESCRIPTION:END -->
