---
id: TASK-262
title: '[bug] Resolve CommonJS `require(''./mod'').name(...)` property-access calls'
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - commonjs-property-access-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `commonjs-property-access-call`. **Observed:** 3

Inline-require chained property access (`require('./mod').name(...)`) doesn't link to definitions in the required module.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
