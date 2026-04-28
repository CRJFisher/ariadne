---
id: TASK-190.16.23
title: '[gap] Add `definition_is_static_method` flag to `definition_features`'
status: To Do
assignee: []
created_date: '2026-04-28 09:33'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - static-method-call-unresolved
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition-is-static-method`

TypeScript/JavaScript `static` class methods cannot be discriminated from instance methods at the classifier level. Even when a class declares `static isFoo(x): x is Foo` and callers do `Class.isFoo(...)`, Ariadne loses the static dispatch context, and classifiers have no signal to filter "definition is `static`" — leading to over-broad classifiers or unworkable rules.

Proposed: add `definition_is_static_method: boolean` to the existing `DefinitionFeatures` derived at extraction time, exposed via the existing `definition_feature_eq` op.

Source: triage-curator sweep. Triggering groups: static-method-call (typeorm), static-method-call-unresolved (typeorm).
<!-- SECTION:DESCRIPTION:END -->
