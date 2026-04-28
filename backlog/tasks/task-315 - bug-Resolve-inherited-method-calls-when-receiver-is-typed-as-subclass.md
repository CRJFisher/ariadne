---
id: TASK-315
title: '[bug] Resolve inherited method calls when receiver is typed as subclass'
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - inherited-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `inherited-method-call`. **Observed:** 1

`subInstance.parentMethod()` should resolve to the inherited method on the parent class.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
