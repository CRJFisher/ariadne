---
id: TASK-259
title: >-
  [bug] Model Angular framework dispatch (lifecycle hooks + template event
  bindings)
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - angular-framework-lifecycle-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `other`. **Target:** `angular-framework-lifecycle-dispatch`. **Observed:** 3

Angular lifecycle hooks (ngOnInit etc.) + template event bindings (`(click)="onClick()"`) need synthetic call edges modeling the framework dispatch.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
