---
id: TASK-190.16.22
title: >-
  [gap] Add workspace-package signal ops to discriminate cross-package monorepo
  imports
status: To Do
assignee: []
created_date: '2026-04-28 09:33'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - cross-package-import-resolution
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `grep_hits_in_different_workspace_package`, `entry_in_workspace_package`

Cross-package npm-name imports in monorepos (e.g. `@prisma/client-common`) cannot be discriminated by classifiers today. Available signals can identify zero callers and a generic file path, but cannot test whether grep hits live in a *different* workspace package than the entry.

Proposed:
- `entry_in_workspace_package`: entry's path matches `/packages/<X>/(src|lib|dist)/`
- `grep_hits_in_different_workspace_package`: at least one grep hit's package segment differs from the entry's

These together let a classifier express "monorepo cross-package call missed" precisely, scoped to the actual signal of interest.

Source: triage-curator sweep. Triggering groups: cross-package-import-resolution, cross-package-workspace-import, tsconfig-paths-import-resolution (prisma).
<!-- SECTION:DESCRIPTION:END -->
