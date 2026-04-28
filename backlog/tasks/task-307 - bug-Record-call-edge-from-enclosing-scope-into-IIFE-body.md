---
id: TASK-307
title: '[bug] Record call edge from enclosing scope into IIFE body'
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-syntactic_extraction
  - iife-not-tracked
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `syntactic_extraction`. **Target:** `iife-not-tracked`. **Observed:** 1

Entry-point detector should record a synthetic call edge from the enclosing scope into the IIFE body.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
