---
id: TASK-260
title: '[bug] Propagate class identity through destructured CommonJS require bindings'
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - static-method-on-destructured-import
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `static-method-on-destructured-import`. **Observed:** 3

`const { Foo } = require('./mod'); Foo.staticMethod(...)` — Foo's class identity should propagate through the destructure.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
