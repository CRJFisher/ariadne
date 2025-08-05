---
id: task-100.15.1
title: Extract range utilities from call_analysis.ts
status: To Do
assignee: []
created_date: '2025-08-05 14:07'
labels: []
dependencies: []
parent_task_id: task-100.15
---

## Description

Extract range-related functions (find_definition_range, is_position_within_range, compute_class_enclosing_range) into a separate range_utils.ts module. These are pure utility functions that calculate ranges and positions.

## Acceptance Criteria

- [ ] Create range_utils.ts with extracted functions
- [ ] Update imports in call_analysis.ts
- [ ] All tests pass
- [ ] File follows immutable patterns
