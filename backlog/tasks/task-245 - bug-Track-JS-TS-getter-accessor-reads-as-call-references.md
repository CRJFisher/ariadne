---
id: TASK-245
title: '[bug] Track JS/TS getter accessor reads as call references'
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - getter-accessor-not-tracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `getter-accessor-not-tracked`
**Observed count:** 6

Getter accessor reads (`obj.foo` triggering `get foo()`) need to be tracked as call references in the `.scm` query.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
