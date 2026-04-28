---
id: TASK-294
title: '[bug] Index MDX files for JSX component reference extraction'
status: To Do
assignee: []
created_date: '2026-04-28 12:10'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - jsx-mdx-component-usage
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `coverage_config`. **Target:** `jsx-mdx-component-usage`. **Observed:** 1

`.mdx` files contain JSX component references but are not indexed by Ariadne.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
