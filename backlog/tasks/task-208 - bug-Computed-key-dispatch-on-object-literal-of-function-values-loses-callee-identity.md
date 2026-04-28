---
id: TASK-208
title: >-
  [bug] Computed-key dispatch on object literal of function values loses callee
  identity
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
**Observed count:** 91

Object literals of the form `{ key1: fn1, key2: fn2 }` dispatched via runtime keys (`obj[runtime_key](...)`) lose the callee identity. The classifier currently uses a permanent stub; needs resolver-side fix.

## Acceptance criteria
- [ ] Ariadne resolver tracks computed-key dispatch on object literals of function values
- [ ] Synthetic call edges from the dispatch site to all candidate function-value entries are emitted
- [ ] Regression test lands and passes

Source: triage-curator sweep (top-impact, observed_count=91).
<!-- SECTION:DESCRIPTION:END -->
