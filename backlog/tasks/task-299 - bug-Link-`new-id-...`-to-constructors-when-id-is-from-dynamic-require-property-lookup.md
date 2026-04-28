---
id: TASK-299
title: >-
  [bug] Link `new <id>(...)` to constructors when id is from dynamic
  require/property lookup
status: To Do
assignee: []
created_date: '2026-04-28 12:11'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - dynamic-require-constructor
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `dynamic-require-constructor`. **Observed:** 1

Class identifiers assigned from dynamic require / property lookup, then instantiated via `new id(...)`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
