---
id: TASK-221
title: '[bug] Reference extraction misses bare-name calls inside class method bodies'
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - intra-file-call-not-resolved
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `intra-file-call-not-resolved`
**Observed count:** 16

Bare-name calls (`foo()` without receiver) inside class method bodies are not captured by the `.scm` reference query. This causes intra-file calls to top-level functions to be missed when the call site is inside a class method.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
