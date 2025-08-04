---
id: task-100.8
title: Fix incoming call detection (task-90)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
labels: []
dependencies:
  - task-90
parent_task_id: task-100
---

## Description

The system fails to detect many incoming calls to functions and methods. This directly impacts the 'nodes-called-by-others' metric (currently 65% vs 85% threshold). Example: ScopeGraph.insert_ref shows 0 incoming calls but is called from scope_resolution.ts.

## Acceptance Criteria

- [ ] Incoming calls correctly detected for all functions
- [ ] Cross-file calls properly tracked
- [ ] Nodes-called-by-others percentage improved
