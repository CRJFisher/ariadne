---
id: TASK-269
title: >-
  [bug] Capture JS/TS getter and setter access as @reference.call in tree-sitter
  queries
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

Variant of TASK-234. Tree-sitter `.scm` queries need to recognise both getter reads and setter writes as call references.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
