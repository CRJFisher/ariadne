---
id: TASK-238
title: >-
  [bug] Trace JS chained static-property access through nested object-literal
  namespaces
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - object-property-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `object-property-dispatch`
**Observed count:** 8

Nested namespace dispatch (`X.Y.Z.method`) loses the receiver identity. Common in legacy JS namespacing.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
