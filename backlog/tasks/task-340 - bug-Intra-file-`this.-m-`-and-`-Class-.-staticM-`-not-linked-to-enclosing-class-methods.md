---
id: TASK-340
title: >-
  [bug] Intra-file `this.<m>()` and `<Class>.<staticM>()` not linked to
  enclosing-class methods
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - instance-method-call-on-unresolved-receiver
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `instance-method-call-on-unresolved-receiver`. **Observed:** 0

Single-hop `this.method()` and `Class.staticMethod()` calls inside the same file should link to the enclosing-class definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
