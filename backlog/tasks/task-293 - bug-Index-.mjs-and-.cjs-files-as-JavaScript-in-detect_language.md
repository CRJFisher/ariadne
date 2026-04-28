---
id: TASK-293
title: '[bug] Index .mjs and .cjs files as JavaScript in detect_language'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - unsupported-file-extension
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `unsupported-file-extension`. **Observed:** 1

`.mjs` / `.cjs` extensions need to be recognized as JavaScript in `detect_language()`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
