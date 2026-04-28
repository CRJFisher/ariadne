---
id: TASK-325
title: >-
  [bug] Resolver does not connect dynamic-key dictionary store-site to call-site
  for stored callbacks
status: To Do
assignee: []
created_date: '2026-04-28 12:14'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - callback-stored-in-dictionary
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `callback-stored-in-dictionary`. **Observed:** 1

`dict[key] = callback` — track function-value flow into computed-key dictionary stores.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
