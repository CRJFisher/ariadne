---
id: TASK-268
title: >-
  [bug] Tree-sitter `@reference.call` capture missing for plain `name(args)`
  calls
status: To Do
assignee: []
created_date: '2026-04-28 12:07'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - indirect-function-reference
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `indirect-function-reference`. **Observed:** 3

Plain `name(args)` calls inside assignment-RHS / callback-body context not captured. Specifically observed in prisma's buffer-small.ts.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
