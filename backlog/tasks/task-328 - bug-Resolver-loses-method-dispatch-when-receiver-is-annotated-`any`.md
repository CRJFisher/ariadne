---
id: TASK-328
title: '[bug] Resolver loses method dispatch when receiver is annotated `any`'
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - any-typed-receiver-method-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `receiver_resolution`. **Target:** `any-typed-receiver-method-call`. **Observed:** 1

TypeScript `any`-typed receiver — Ariadne should fall back to name-based dispatch heuristics.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
