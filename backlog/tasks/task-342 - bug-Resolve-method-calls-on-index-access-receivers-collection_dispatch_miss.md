---
id: TASK-342
title: >-
  [bug] Resolve method calls on index-access receivers
  (collection_dispatch_miss)
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - unresolved-receiver-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `unresolved-receiver-method-dispatch`. **Observed:** 0

`array[i].method()`, `map.get(key).method()` — index-access receivers lose type at method dispatch.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
