---
id: TASK-256
title: '[bug] Resolve tsconfig `paths` aliases to local monorepo packages'
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - cross-package-call-untracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `cross-package-call-untracked`. **Observed:** 4

Resolver should load `tsconfig.compilerOptions.paths` and rewrite path-aliased imports to local source files.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
