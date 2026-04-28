---
id: TASK-314
title: >-
  [bug] Resolve chained method calls when receiver is from `T =
  Injector.get<T>(token)`
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dependency-injection-type-resolution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dependency-injection-type-resolution`. **Observed:** 1

Generic `Injector.get<T>(token)` returns `T`; subsequent `.method()` calls should resolve via the type parameter.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
