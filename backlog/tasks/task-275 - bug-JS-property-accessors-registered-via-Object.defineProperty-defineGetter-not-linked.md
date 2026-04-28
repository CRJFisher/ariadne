---
id: TASK-275
title: >-
  [bug] JS property accessors registered via Object.defineProperty/defineGetter
  not linked
status: To Do
assignee: []
created_date: '2026-04-28 12:08'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - dynamic-getter-registration
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `dynamic-getter-registration`. **Observed:** 2

`Object.defineProperty(obj, 'name', { get: fn })` / `__defineGetter__` patterns — runtime accessor registration not linked to property-read call sites.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
