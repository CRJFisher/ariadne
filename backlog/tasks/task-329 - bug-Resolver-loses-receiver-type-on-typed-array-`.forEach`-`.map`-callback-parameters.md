---
id: TASK-329
title: >-
  [bug] Resolver loses receiver type on typed-array `.forEach`/`.map` callback
  parameters
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - method-call-on-callback-parameter
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `method-call-on-callback-parameter`. **Observed:** 1

`Array<Foo>.forEach((item) => item.method())` — propagate the array's element type to the callback parameter.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
