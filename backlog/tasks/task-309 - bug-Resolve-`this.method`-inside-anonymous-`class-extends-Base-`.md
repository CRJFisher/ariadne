---
id: TASK-309
title: '[bug] Resolve `this.method()` inside anonymous `class extends Base {}`'
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - anonymous-class-inheritance-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `anonymous-class-inheritance-resolution`. **Observed:** 1

Class expressions — `this.method()` inside should resolve to inherited `Base.method`.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
