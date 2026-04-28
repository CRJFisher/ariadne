---
id: TASK-332
title: '[bug] Trace function values through object-property store + destructure'
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - stored-callback-via-object-property
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `stored-callback-via-object-property`. **Observed:** 1

`obj.callback = fn; const { callback } = obj; callback();` — track through both store and destructure.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
