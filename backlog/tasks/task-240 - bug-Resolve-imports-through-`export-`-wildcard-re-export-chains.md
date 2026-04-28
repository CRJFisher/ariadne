---
id: TASK-240
title: '[bug] Resolve imports through `export *` wildcard re-export chains'
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - barrel-reexport
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `import_resolution`
**Target registry entry:** `barrel-reexport`
**Observed count:** 7

Resolver does not follow `export * from './sub'` chains across multiple barrel files.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
