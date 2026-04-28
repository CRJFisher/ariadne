---
id: TASK-207
title: '[bug] Trace by-name function references through callback-registration calls'
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-cross_file_flow
  - callback-registration
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `cross_file_flow`
**Target registry entry:** `callback-registration`
**Observed count:** 97

Functions referenced by-name as callback arguments (`registerHandler(myFunc)`, `arr.map(myFunc)`, `obj.on('event', handler)`) lose their function identity across the registration call. Ariadne does not link the callback definition to the registration call site, so the function appears to have zero callers.

Triggering corpora: jquery, angular, lodash, typeorm, prisma — high-frequency pattern across event-handler libraries and array-callback APIs.

## Acceptance criteria
- [ ] Ariadne resolver tracks function-value flow into HOF call arguments and stores synthetic call edges
- [ ] Regression test reproducing the by-name callback-registration pattern lands and passes
- [ ] Registry entry `callback-registration` is removed or marked `fixed` after Ariadne fix

Source: triage-curator sweep (top-impact, observed_count=97).
<!-- SECTION:DESCRIPTION:END -->
