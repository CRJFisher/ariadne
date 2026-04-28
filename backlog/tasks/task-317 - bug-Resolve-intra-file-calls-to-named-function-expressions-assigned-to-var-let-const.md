---
id: TASK-317
title: >-
  [bug] Resolve intra-file calls to named function expressions assigned to
  var/let/const
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - same-file-call-missed
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `same-file-call-missed`. **Observed:** 1

Sibling of TASK-235. Cover let/const variants.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
