---
id: TASK-243
title: >-
  [bug] Resolve bare-specifier imports to monorepo workspace package source
  files
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - cross-package-method-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `import_resolution`
**Target registry entry:** `cross-package-method-resolution`
**Observed count:** 6

`import { x } from "@scope/pkg"` should resolve to `packages/pkg/src/...` in monorepos. Currently bare specifiers fail import resolution.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
