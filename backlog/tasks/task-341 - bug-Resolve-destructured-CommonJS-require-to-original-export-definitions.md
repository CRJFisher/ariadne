---
id: TASK-341
title: '[bug] Resolve destructured CommonJS require to original export definitions'
status: To Do
assignee: []
created_date: '2026-04-28 12:16'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - js-commonjs-require-destructure
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `js-commonjs-require-destructure`. **Observed:** 0

`const { foo } = require('./mod')` — link `foo` to the original export.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
