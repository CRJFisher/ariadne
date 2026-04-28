---
id: TASK-302
title: >-
  [bug] Model external-interface dispatch (e.g. ts.CompilerHost) as synthetic
  call edges
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - external-framework-interface-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `external-framework-interface-dispatch`. **Observed:** 1

Classes implementing external interfaces (e.g. `ts.CompilerHost`) are dispatched by external code; need synthetic call edges for in-tree implementations.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
