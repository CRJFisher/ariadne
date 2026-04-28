---
id: TASK-288
title: '[bug] Treat bare property access of class getters/setters as call references'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - dynamic-or-untyped-property-access
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `dynamic-or-untyped-property-access`. **Observed:** 2

Bare property access (no `()`) on getters/setters needs call-reference treatment.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
