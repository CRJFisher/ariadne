---
id: TASK-227
title: '[bug] String-keyed function map lookup not modelled as a call edge'
status: To Do
assignee: []
created_date: '2026-04-28 09:40'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - compiler-generated-dynamic-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `compiler-generated-dynamic-dispatch`
**Observed count:** 11

Compiler-generated dispatch through string-keyed function tables (e.g. JIT translation registries) — the lookup `table[stringKey](args)` is not modelled as a call edge to the function-value entries.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
