---
id: TASK-297
title: '[bug] JS dynamic namespace property write loses receiver type'
status: To Do
assignee: []
created_date: '2026-04-28 12:11'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-property-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dynamic-property-method-dispatch`. **Observed:** 1

`Foo.bar = new Class()` followed by `Foo.bar.method()` doesn't resolve to `Class.prototype.method`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
