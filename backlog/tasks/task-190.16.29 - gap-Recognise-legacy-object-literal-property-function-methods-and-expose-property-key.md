---
id: TASK-190.16.29
title: >-
  [gap] Recognise legacy object-literal property-function methods and expose
  property key
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - method-on-object-literal
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-is-object-literal-property-function`, `definition-object-literal-property-name`, `grep-callsites-match-object-literal-property-key`

The existing `definition_is_object_literal_method` flag (TASK-190.16.13) only fires for ES6 shorthand methods (`kind: "method"`). Legacy `key: function() {}` form parses as `kind: "function"` with name `<anonymous>`, so the flag is false even though semantically these are object-literal methods.

Proposed signals recognise the legacy form, expose its property key, and let grep-driven classifiers match `<receiver>.<key>(` callsites.

Source: triage-curator sweep. Triggering groups: method-on-object-literal, object-literal-method-dispatch, object-literal-method-with-scope (lodash; large vendor file `firebug-lite-debug.js`).
<!-- SECTION:DESCRIPTION:END -->
