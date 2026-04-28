---
id: TASK-209
title: '[bug] Include test directories in default indexing scope'
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-coverage_config
  - unindexed-test-files
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `coverage_config`
**Target registry entry:** `unindexed-test-files`
**Observed count:** 81

Test directories (`__tests__/`, `*.test.ts`, `*.spec.ts`) are excluded from the default indexing scope by `LoadProjectOptions`. As a result, functions with their *only* callers in test files appear unreachable.

This task may overlap with existing TASK-190.13 (`caller_folders` config option).

## Acceptance criteria
- [ ] `LoadProjectOptions` accepts a `caller_folders[]` option (or equivalent) that includes test dirs in second-pass caller resolution
- [ ] Default behaviour follows convention: `**/*.test.{ts,js}` and `**/*.spec.{ts,js}` and `__tests__/**` are scanned for callers (but not added as entrypoints)
- [ ] Self-repair pipeline re-run no longer flags purely test-only-called symbols

Source: triage-curator sweep (top-impact, observed_count=81).
<!-- SECTION:DESCRIPTION:END -->
