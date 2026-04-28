---
id: TASK-321
title: '[bug] Resolve method dispatch through aliased TypeScript imports'
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - aliased-import-method-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `aliased-import-method-dispatch`. **Observed:** 1

`import { Foo as F } from './mod'; F.method()` — resolve through the alias.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
