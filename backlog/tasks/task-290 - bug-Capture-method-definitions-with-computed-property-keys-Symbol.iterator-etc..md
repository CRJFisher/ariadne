---
id: TASK-290
title: >-
  [bug] Capture method definitions with computed property keys (Symbol.iterator
  etc.)
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - computed-property-method-caller
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `computed-property-method-caller`. **Observed:** 1

`[Symbol.iterator]()`, `[Symbol.asyncIterator]()` style methods need extractor recognition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
