---
id: TASK-190.16.58
title: >-
  [gap] Add definition-site context signals for inner named functions returned
  from factories
status: To Do
assignee: []
created_date: '2026-04-28 11:55'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - closure-returned-function
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signals needed:** `definition-enclosing-return-statement`, `definition-is-named-function-expression`

Inner named function expressions returned from factories — need definition-site signals for both the enclosing return statement and the named-function-expression form.

Source: triage-curator sweep. Triggering group: closure-returned-function.
<!-- SECTION:DESCRIPTION:END -->
