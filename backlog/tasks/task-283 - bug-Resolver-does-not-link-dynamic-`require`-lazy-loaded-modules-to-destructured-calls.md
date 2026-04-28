---
id: TASK-283
title: >-
  [bug] Resolver does not link dynamic `require()` / lazy-loaded modules to
  destructured calls
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - dynamic-require-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `dynamic-require-resolution`. **Observed:** 2

Dynamic `require()` / lazy-loaded modules with destructured call sites lose the binding.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
