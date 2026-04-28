---
id: TASK-258
title: >-
  [bug] JS/TS class getter read via property access not captured as a caller
  edge
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - getter-access-not-tracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `getter-access-not-tracked`. **Observed:** 3

Reads of `obj.foo` where `foo` is a getter accessor produce no `@reference.call` capture in the `.scm` query.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
