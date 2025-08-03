---
id: task-87
title: >-
  Fix cross-file call tracking - functions called from other files show 0
  incoming calls
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The call graph fails to track when functions are called from other files. For example, extract_function_metadata is called from scope_resolution.ts but shows 0 incoming calls. This causes functions to be incorrectly marked as top-level when they are actually used internally.

## Acceptance Criteria

- [ ] Functions called from other files have incoming_calls count > 0
- [ ] Top-level detection correctly excludes functions that are called internally
- [ ] Cross-file call relationships are accurately tracked in the call graph

## Implementation Notes

Test cases from validation:
- extract_function_metadata: Shows 0 incoming calls but is called from scope_resolution.ts:346
- apply_max_depth_filter: Shows 0 incoming calls but is called from project_call_graph.ts:1324
- build_scope_graph: Shows 0 incoming calls but is called from index.ts:159
- is_position_within_range: Shows 0 incoming calls but has multiple calls in project_call_graph.ts

These functions are all marked as top-level (0 called_by_count) despite having clear internal usage.
