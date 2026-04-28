---
id: TASK-257
title: '[bug] Extract legacy `prop: function() {}` as object-literal method'
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - mixin-inheritance-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `mixin-inheritance-dispatch`. **Observed:** 3

Extractor only sets `kind=method` and `definition_is_object_literal_method=true` for ES6 method shorthand. Legacy `prop: function() {}` parses as `kind=function` with `name=<anonymous>`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
