---
id: TASK-254
title: >-
  [bug] Resolve method calls through Map-get receivers (class-property
  assignment registry)
status: To Do
assignee: []
created_date: '2026-04-28 12:05'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - dynamic-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `dynamic-dispatch`. **Observed:** 4

`registry.get(ctor)` where values are registered via `<ParentCtor>.<Field> = <TemplateClass>` (webpack `dependencyTemplates` pattern). Bind the call's receiver-type to the registered value type so concrete subclass methods are reachable.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
