---
id: TASK-190.16.37
title: '[gap] Add `definition_neighbourhood_matches` SignalCheck op'
status: To Do
assignee: []
created_date: '2026-04-28 11:52'
labels:
  - self-repair-pipeline
  - signal-gap
  - triage-curator
  - prototype-inheritance-dispatch
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Signal needed:** `definition-neighbourhood-matches`

A regex op over source lines above the definition site, symmetric to `grep_hit_neighbourhood_matches` but anchored on the entry's own location. Lets classifiers detect surrounding context (e.g. `X.prototype = {` on the line above).

Source: triage-curator sweep. Triggering group: prototype-inheritance-dispatch.
<!-- SECTION:DESCRIPTION:END -->
