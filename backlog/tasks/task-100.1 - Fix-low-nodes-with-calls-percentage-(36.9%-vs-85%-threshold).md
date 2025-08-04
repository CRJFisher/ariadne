---
id: task-100.1
title: Fix low nodes-with-calls percentage (36.9% vs 85% threshold)
status: To Do
assignee: []
created_date: '2025-08-04 11:54'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The validation shows only 36.9% of nodes have outgoing calls, but the threshold is 85%. This suggests many function calls are not being detected properly.

## Acceptance Criteria

- [ ] Nodes with calls percentage >= 85%
- [ ] Add test cases for missed calls
- [ ] Root cause identified and fixed
