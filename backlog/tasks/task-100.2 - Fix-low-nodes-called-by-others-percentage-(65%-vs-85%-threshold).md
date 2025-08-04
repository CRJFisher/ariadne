---
id: task-100.2
title: Fix low nodes-called-by-others percentage (65% vs 85% threshold)
status: To Do
assignee: []
created_date: '2025-08-04 11:54'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The validation shows only 65% of nodes are called by other functions, but the threshold is 85%. This indicates incoming call tracking is missing many relationships.

## Acceptance Criteria

- [ ] Nodes called by others percentage >= 85%
- [ ] Add test cases for missed incoming calls
- [ ] Root cause identified and fixed
