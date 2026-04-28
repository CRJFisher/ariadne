---
id: TASK-250
title: '[bug] JS/TS CommonJS require-bound namespace receiver loses module type'
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - commonjs-module-property-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `commonjs-module-property-call`. **Observed:** 4

`const ns = require('./mod'); ns.func(...)` — the receiver `ns` loses its module type at method lookup.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
