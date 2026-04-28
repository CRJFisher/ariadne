---
id: TASK-304
title: '[bug] Project walker silently drops `.ts` files within indexed source roots'
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - import-resolution-miss
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `import-resolution-miss`. **Observed:** 1

Sibling of TASK-292. Intra-package coverage holes — files in indexed source roots that don't make it into the project walk.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
