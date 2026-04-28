---
id: TASK-279
title: >-
  [bug] Resolve `this` receiver to enclosing object literal in JS/TS method
  dispatch
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - this-property-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `this-property-method-dispatch`. **Observed:** 2

Bind `this` to enclosing object literal at method dispatch.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
