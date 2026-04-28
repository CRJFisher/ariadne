---
id: TASK-190.16.95
title: '[gap] Add tsconfig `paths` awareness to Ariadne import resolution + signal'
status: To Do
assignee: []
created_date: '2026-04-28 11:59'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - tsconfig-path-alias
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `caller-import-uses-tsconfig-path-alias`, `tsconfig-paths-loaded-into-project`

Resolver loads `tsconfig.compilerOptions.paths` + classifiers can detect callers using path aliases.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
