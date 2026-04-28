---
id: TASK-285
title: >-
  [bug] Static call graph cannot follow dynamic file-path injection by build
  plugins
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - dynamic-runtime-injection
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `other`. **Target:** `dynamic-runtime-injection`. **Observed:** 2

Build plugins (esbuild fillers, webpack DefinePlugin, etc.) inject file paths at compile time. Static call graph misses these dispatches.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
