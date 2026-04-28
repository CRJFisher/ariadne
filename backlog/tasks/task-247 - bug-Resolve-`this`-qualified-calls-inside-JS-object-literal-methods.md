---
id: TASK-247
title: '[bug] Resolve `this`-qualified calls inside JS object-literal methods'
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - this-object-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `this-object-method-dispatch`. **Observed:** 5

Inside an object-literal method, `this.<other>(...)` should resolve to sibling properties of the same literal.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
