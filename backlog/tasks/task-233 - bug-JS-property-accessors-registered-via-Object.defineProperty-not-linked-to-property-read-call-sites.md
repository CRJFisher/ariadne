---
id: TASK-233
title: >-
  [bug] JS property accessors registered via Object.defineProperty not linked to
  property-read call sites
status: To Do
assignee: []
created_date: '2026-04-28 09:41'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - object-define-property-getter
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `syntactic_extraction`
**Target registry entry:** `object-define-property-getter`
**Observed count:** 9

`Object.defineProperty(obj, 'name', { get: () => ... })` creates a getter that fires on `obj.name` reads. The reference extraction does not synthesize a call edge from the read site to the getter function.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
