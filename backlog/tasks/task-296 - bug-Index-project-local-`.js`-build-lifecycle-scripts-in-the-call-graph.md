---
id: TASK-296
title: '[bug] Index project-local `.js` build/lifecycle scripts in the call graph'
status: To Do
assignee: []
created_date: '2026-04-28 12:11'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - unindexed-script-caller
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `unindexed-script-caller`. **Observed:** 1

Project-local `.js` build/lifecycle scripts (helpers, sandbox) need to be indexed so they participate in the call graph as callers.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
