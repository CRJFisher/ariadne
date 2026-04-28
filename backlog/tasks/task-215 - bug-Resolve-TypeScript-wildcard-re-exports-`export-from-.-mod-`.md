---
id: TASK-215
title: '[bug] Resolve TypeScript wildcard re-exports (`export * from "./mod"`)'
status: To Do
assignee: []
created_date: '2026-04-28 09:38'
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
**Observed count:** 41

Sibling barrel `index.ts` files re-exporting individual modules via `export * from './mod'` do not propagate import targets through to callers. Symbol resolution stops at the barrel.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
