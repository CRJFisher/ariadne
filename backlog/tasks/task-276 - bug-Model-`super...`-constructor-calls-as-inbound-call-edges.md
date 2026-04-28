---
id: TASK-276
title: '[bug] Model `super(...)` constructor calls as inbound call edges'
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - super-constructor-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `super-constructor-call`. **Observed:** 2

Sibling of TASK-225. `super(...)` call sites need synthetic call edges to the parent class constructor.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
