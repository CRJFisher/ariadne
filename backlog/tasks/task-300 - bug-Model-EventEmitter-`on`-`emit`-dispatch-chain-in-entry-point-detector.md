---
id: TASK-300
title: '[bug] Model EventEmitter `on`/`emit` dispatch chain in entry-point detector'
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - event-emitter-callback
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `cross_file_flow`. **Target:** `event-emitter-callback`. **Observed:** 1

EventEmitter `on(name, handler)` registers handlers that are dispatched by `emit(name, ...)`. Entry-point detector should model this dispatch.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
