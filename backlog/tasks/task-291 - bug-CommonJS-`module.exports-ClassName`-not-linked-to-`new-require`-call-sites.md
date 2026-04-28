---
id: TASK-291
title: >-
  [bug] CommonJS `module.exports = ClassName` not linked to `new require()()`
  call sites
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - module-exports-class-constructor
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `module-exports-class-constructor`. **Observed:** 1

CommonJS classes exported via `module.exports = ClassName` and instantiated via `new require('./X')()` lose the link.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
