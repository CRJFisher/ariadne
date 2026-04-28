---
id: TASK-330
title: '[bug] Static method lookup does not walk subclass `extends` chain'
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - inherited-static-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `inherited-static-method-dispatch`. **Observed:** 1

`Subclass.staticMethod()` should walk to parent class for inherited statics.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
