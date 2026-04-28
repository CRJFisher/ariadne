---
id: TASK-190.16.38
title: >-
  [gap] Add `resolution_failure_import_target_matches_entry_file` op for CJS/ESM
  module-qualified call discrimination
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - commonjs-module-property-call
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `resolution_failure_import_target_matches_entry_file`

When a resolution failure carries an import target, classifiers need to know whether that target points back to the entry's own file — discriminating module-qualified calls within a single project.

Source: triage-curator sweep. Triggering group: commonjs-module-property-call.
<!-- SECTION:DESCRIPTION:END -->
