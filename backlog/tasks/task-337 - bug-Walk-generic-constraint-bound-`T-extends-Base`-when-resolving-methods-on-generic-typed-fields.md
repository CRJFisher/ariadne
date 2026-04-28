---
id: TASK-337
title: >-
  [bug] Walk generic constraint bound (`T extends Base`) when resolving methods
  on generic-typed fields
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - generic-type-erasure
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `generic-type-erasure`. **Observed:** 1

For a field typed `T extends Base`, method lookup should consult `Base` when `T` is not narrowed.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
