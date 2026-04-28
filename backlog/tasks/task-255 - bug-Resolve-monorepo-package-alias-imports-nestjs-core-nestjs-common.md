---
id: TASK-255
title: '[bug] Resolve monorepo package-alias imports (@nestjs/core, @nestjs/common)'
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - cross-package-method-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `cross-package-method-resolution`. **Observed:** 4

NestJS-specific monorepo aliases (`@nestjs/core`, `@nestjs/common`) — sibling of TASK-243; broader pattern for arbitrary scoped-package aliases.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
