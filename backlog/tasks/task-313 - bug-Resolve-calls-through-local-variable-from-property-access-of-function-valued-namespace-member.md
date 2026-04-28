---
id: TASK-313
title: >-
  [bug] Resolve calls through local variable from property access of
  function-valued namespace member
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - property-alias-intra-file-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `property-alias-intra-file-call`. **Observed:** 1

`const f = NS.func; f(...)` — track the alias.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
