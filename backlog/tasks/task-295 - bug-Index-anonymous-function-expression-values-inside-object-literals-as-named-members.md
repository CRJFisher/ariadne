---
id: TASK-295
title: >-
  [bug] Index anonymous function-expression values inside object literals as
  named members
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - object-literal-method-with-scope
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `object-literal-method-with-scope`. **Observed:** 1

`{ name: function() {} }` — index the anonymous function under `<enclosing>.name` rather than as a free `<anonymous>` definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
