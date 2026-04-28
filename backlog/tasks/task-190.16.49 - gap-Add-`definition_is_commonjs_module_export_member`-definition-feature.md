---
id: TASK-190.16.49
title: '[gap] Add `definition_is_commonjs_module_export_member` definition feature'
status: To Do
assignee: []
created_date: '2026-04-28 11:54'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - commonjs-property-access-call
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition-is-commonjs-module-export-member`

Member of a CommonJS object-literal exports (`module.exports = { foo: function() {} }`) — needs a definition-side flag so classifiers can target this dispatch shape.

Source: triage-curator sweep. Triggering group: commonjs-property-access-call.
<!-- SECTION:DESCRIPTION:END -->
