---
id: TASK-306
title: >-
  [bug] Receiver type lost at module-level `const x = new Class()` (singleton
  pattern)
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - singleton-instance-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `singleton-instance-method-call`. **Observed:** 1

Module-level `const x = new Class()` binding — receiver type lost at method dispatch on `x.method()`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
