---
id: TASK-292
title: >-
  [bug] File walker silently drops legitimate `.ts` source files inside indexed
  directories
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - cross-file-import-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `cross-file-import-resolution`. **Observed:** 1

The project walker silently drops some `.ts` files within indexed scope. Need to identify the silent-skip cases.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
