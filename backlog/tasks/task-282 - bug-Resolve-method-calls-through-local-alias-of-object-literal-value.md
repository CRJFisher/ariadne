---
id: TASK-282
title: '[bug] Resolve method calls through local alias of object-literal value'
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - aliased-object-property-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `aliased-object-property-call`. **Observed:** 2

`const alias = obj.method; alias(...)` — track the function-value flow through the alias assignment.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
