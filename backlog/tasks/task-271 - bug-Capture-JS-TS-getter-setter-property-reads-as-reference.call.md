---
id: TASK-271
title: '[bug] Capture JS/TS getter/setter property reads as @reference.call'
status: To Do
assignee: []
created_date: '2026-04-28 12:08'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - property-accessor-not-tracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `property-accessor-not-tracked`. **Observed:** 2

Sibling of TASK-234. Property reads of accessors (without `()`) need to count as call references.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
