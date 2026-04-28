---
id: TASK-217
title: >-
  [bug] Capture method calls on ECMAScript private-field properties in TS/JS
  .scm queries
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - private-class-field-method
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `private-class-field-method`
**Observed count:** 18

The TS/JS `call_expression` query in the `.scm` files does not capture `this.#method()` invocations (private_property_identifier). As a result, callers of private-field methods are missed.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
