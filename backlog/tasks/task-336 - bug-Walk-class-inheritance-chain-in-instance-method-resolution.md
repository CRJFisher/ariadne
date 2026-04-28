---
id: TASK-336
title: '[bug] Walk class inheritance chain in instance-method resolution'
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - inherited-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `inherited-method-dispatch`. **Observed:** 1

When method lookup misses on the receiver's class, walk the `extends` chain.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
