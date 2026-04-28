---
id: TASK-326
title: >-
  [bug] Resolver does not follow function-valued properties through mixin /
  merge-descriptors utilities
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - prototype-mixin-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `prototype-mixin-dispatch`. **Observed:** 1

Mixin / merge-descriptors utilities copy function-valued properties; resolver should track this flow.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
