---
id: TASK-211
title: >-
  [bug] Resolver cannot link `obj[runtime_key](...)` to object-literal property
  function values
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-property-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `dynamic-property-dispatch`
**Observed count:** 67

Bracket-access dispatch (`registry[key](...)`) on object literals of function values is unmodelled. Even when both the literal and the dispatch site are in the same file, no call edges are emitted.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
