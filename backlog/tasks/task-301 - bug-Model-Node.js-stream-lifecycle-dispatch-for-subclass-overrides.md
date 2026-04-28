---
id: TASK-301
title: '[bug] Model Node.js stream lifecycle dispatch for subclass overrides'
status: To Do
assignee: []
created_date: '2026-04-28 12:12'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - framework-lifecycle-override
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `other`. **Target:** `framework-lifecycle-override`. **Observed:** 1

Node.js stream subclasses override `_read`/`_write` lifecycle methods invoked by the framework.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
