---
id: TASK-248
title: '[bug] Resolve method calls on typed instance receivers (locals + class fields)'
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - instance-method-call-unresolved
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `instance-method-call-unresolved`. **Observed:** 5

`const x = new C()` followed by `x.method()`; `this.field` typed as `C` followed by `this.field.method()`. Single-hop receiver resolution.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
