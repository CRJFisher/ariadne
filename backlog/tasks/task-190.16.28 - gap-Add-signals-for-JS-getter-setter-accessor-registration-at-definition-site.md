---
id: TASK-190.16.28
title: >-
  [gap] Add signals for JS getter/setter accessor registration at definition
  site
status: To Do
assignee: []
created_date: '2026-04-28 09:34'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - object-define-property-getter
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-site-enclosing-call`, `registered-as-property-accessor`

JS getter/setter accessors registered via `Object.defineProperty(obj, 'name', { get: ... })` cannot be discriminated from regular function definitions. The enclosing call context is invisible to classifiers.

Proposed signals expose the enclosing-call shape of the definition site and a derived `registered-as-property-accessor` flag.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
