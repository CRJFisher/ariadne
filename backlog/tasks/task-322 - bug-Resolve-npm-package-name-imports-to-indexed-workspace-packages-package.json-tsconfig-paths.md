---
id: TASK-322
title: >-
  [bug] Resolve npm-package-name imports to indexed workspace packages
  (package.json + tsconfig paths)
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - tsconfig-paths-import-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `tsconfig-paths-import-resolution`. **Observed:** 1

Combined `package.json` `name` field + `tsconfig.compilerOptions.paths` resolution to indexed workspace packages.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
