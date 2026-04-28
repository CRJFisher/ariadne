---
id: TASK-278
title: '[bug] Resolve `export * as <NS> from ''<path>''` namespace re-exports'
status: To Do
assignee: []
created_date: '2026-04-28 12:09'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - namespace-reexport-member-access
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `namespace-reexport-member-access`. **Observed:** 2

Namespace re-exports (`export * as ns from './mod'`) — calls via `ns.member()` should resolve through to the original definition.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
