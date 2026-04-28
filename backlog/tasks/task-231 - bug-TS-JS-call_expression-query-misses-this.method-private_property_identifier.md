---
id: TASK-231
title: >-
  [bug] TS/JS call_expression query misses this.#method()
  (private_property_identifier)
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - private-field-method-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `private-field-method-resolution`
**Observed count:** 10

The `call_expression` `.scm` query in JS/TS does not match `this.#method()` because `private_property_identifier` is a different node kind from `property_identifier`. Variant of TASK-217 — same target.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
