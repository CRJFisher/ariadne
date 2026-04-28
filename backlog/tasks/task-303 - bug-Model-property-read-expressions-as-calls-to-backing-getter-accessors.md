---
id: TASK-303
title: '[bug] Model property-read expressions as calls to backing getter accessors'
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - property-getter-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `property-getter-dispatch`. **Observed:** 1

Property reads on classes with getters need to be modeled as calls to the backing getter.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
