---
id: TASK-224
title: >-
  [bug] Track method dispatch on instances passed to external framework
  registration calls
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - framework-lifecycle-handler
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `framework-lifecycle-handler`
**Observed count:** 12

Framework lifecycle handlers (e.g. NestJS module providers, Angular DI, Kafka partition assigners) are registered with external libraries and invoked indirectly. Ariadne does not model these synthetic call edges.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
