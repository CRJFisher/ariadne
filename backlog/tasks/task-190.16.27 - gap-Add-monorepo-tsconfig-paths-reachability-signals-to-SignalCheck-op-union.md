---
id: TASK-190.16.27
title: '[gap] Add monorepo/tsconfig-paths reachability signals to SignalCheck op union'
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - cross-package-call-untracked
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `tsconfig-paths-alias-target`, `barrel-reexport-of-entry`

Classifiers cannot reason about tsconfig.compilerOptions.paths aliases or barrel re-export chains in monorepos. Two new signals expose:
- `tsconfig-paths-alias-target`: whether the entry's package is referenced by a tsconfig paths alias
- `barrel-reexport-of-entry`: whether a sibling barrel `index.ts` re-exports the entry's source file

Source: triage-curator sweep. Triggering groups: cross-package-call-untracked, tsconfig-path-alias.
<!-- SECTION:DESCRIPTION:END -->
