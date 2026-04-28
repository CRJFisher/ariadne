---
id: TASK-242
title: >-
  [bug] JS receiver-type resolution fails across JSDoc / prototype methods /
  class-field receivers
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - unresolved-receiver-type
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `unresolved-receiver-type`
**Observed count:** 6

JS receiver-type inference fails for: JSDoc-annotated parameters, prototype-attached methods, class-field receivers without annotations.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
