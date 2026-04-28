---
id: TASK-249
title: >-
  [bug] Trace method calls through chained-call receivers using declared return
  types
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - method-chain-return-type-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `method-chain-return-type-resolution`. **Observed:** 5

`getInner().method()` — use the inner call's declared return type to resolve `.method()`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
