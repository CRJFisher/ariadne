---
id: TASK-286
title: '[bug] Track prototype-property function assignments as methods'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - property-alias-assignment
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `property-alias-assignment`. **Observed:** 2

`proto.name = function () {}` — extractor should treat these as methods on the prototype object.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
