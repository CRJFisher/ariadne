---
id: TASK-334
title: >-
  [bug] TypeScript named-import call across sibling subdirectory not linked to
  definition
status: To Do
assignee: []
created_date: '2026-04-28 12:15'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - import-resolution-missed
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `import-resolution-missed`. **Observed:** 1

`import { x } from '../sibling/mod'` — sibling subdirectory imports fail.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
