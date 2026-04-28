---
id: TASK-287
title: '[bug] Treat TS/JS getter and setter accessor invocations as call references'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
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

Sibling of TASK-234. Treat both getter reads and setter writes as call references.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
