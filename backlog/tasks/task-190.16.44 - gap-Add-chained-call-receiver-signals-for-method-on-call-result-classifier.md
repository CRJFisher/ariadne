---
id: TASK-190.16.44
title: '[gap] Add chained-call-receiver signals for method-on-call-result classifier'
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - method-chain-return-type-resolution
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `grep-hit-call-on-call-expression-receiver`, `definition-feature-name-bound-to-callable-return-type`

Discriminates `<call>().method()` patterns at the grep level, plus exposes the inferred callable return type for the entry's enclosing function.

Source: triage-curator sweep. Triggering group: method-chain-return-type-resolution.
<!-- SECTION:DESCRIPTION:END -->
