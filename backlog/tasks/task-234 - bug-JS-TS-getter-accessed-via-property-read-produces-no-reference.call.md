---
id: TASK-234
title: '[bug] JS/TS getter accessed via property read produces no @reference.call'
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - property-accessor-not-tracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `property-accessor-not-tracked`
**Observed count:** 9

`get foo() { ... }` accessor invoked via `obj.foo` (without `()`) produces no call reference in the `.scm` query. Reads of accessor properties are call sites but not captured as such.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
