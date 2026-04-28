---
id: TASK-210
title: >-
  [bug] Resolver cannot link computed-key callback-table dispatch to
  function-expression value
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-property-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `dynamic-property-dispatch`
**Observed count:** 73

Variant of dynamic-property-dispatch where the callback table is keyed by a runtime expression and Ariadne loses the function-expression value at the property access. Distinct from the cross_file_flow variant (entry above) — this one is specifically about receiver-type loss when the receiver is itself a property access on a registry.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
