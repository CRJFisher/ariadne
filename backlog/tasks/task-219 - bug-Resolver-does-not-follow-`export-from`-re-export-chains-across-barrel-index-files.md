---
id: TASK-219
title: >-
  [bug] Resolver does not follow `export * from` re-export chains across barrel
  index files
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
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
**Observed count:** 17

Multi-hop re-export chains (`barrel.ts -> sub_barrel.ts -> impl.ts`) are not resolved. Distinct from TASK-215 which scopes to single-hop wildcard re-exports.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
