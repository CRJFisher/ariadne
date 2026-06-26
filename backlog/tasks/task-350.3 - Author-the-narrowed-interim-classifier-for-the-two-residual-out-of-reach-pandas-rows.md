---
id: TASK-350.3
title: "Author the narrowed interim classifier for the two residual out-of-reach pandas rows"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: medium
ordinal: 3000
plan_dedup_key: 4230a27b8a6b339a953c6aaf5e90be13cafed7b7e1294d32099d3879a27e5946
plan_source_task: pt-af4f58c1a6b4d5cc
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Retire most of the interim-classifier scope: with Fixes A–C landed and the existing builtin classify_entry_points/builtins/check_receiver-type-unknown.ts (covering the JS identifier-receiver shape), the 30+ members the core fixes resolve no longer need a classifier.

2. Author the interim classifier only for the two genuinely-out-of-static-reach pandas rows: the fixture-injected Styler _repr_html_ row, and the Cython-object self.obj \_set_value row (indexing.py:3171).

3. Do not classify any member resolved by Fixes A–C. Sequence this last (after the three feeder fixes and the Python verification re-run), per the plan's ordering.

4. This is the only residual false-positive surface; scope the classifier narrowly to those two receivers so it does not mask the now-resolved clusters.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->
