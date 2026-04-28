---
id: TASK-308
title: >-
  [bug] Resolve JS method calls on locally-assigned identifier receivers lacking
  declared types
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - receiver-type-unknown
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `receiver-type-unknown`. **Observed:** 1

JS without type annotations — track receiver type through assignment chains.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
