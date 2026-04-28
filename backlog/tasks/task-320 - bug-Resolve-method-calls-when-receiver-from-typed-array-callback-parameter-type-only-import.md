---
id: TASK-320
title: >-
  [bug] Resolve method calls when receiver from typed-array callback parameter /
  type-only import
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - method-call-on-typed-instance
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `method-call-on-typed-instance`. **Observed:** 1

Receiver type bound from `arr.forEach((item: T) => item.method())` or type-only imports.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
