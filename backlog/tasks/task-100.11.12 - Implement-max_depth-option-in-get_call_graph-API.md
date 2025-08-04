---
id: task-100.11.12
title: Implement max_depth option in get_call_graph API
status: To Do
assignee: []
created_date: '2025-08-04 16:43'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

The CallGraphOptions interface includes a max_depth option that should limit the depth of the call graph traversal. This feature is not currently implemented in the adapter, causing one test to fail. The implementation should limit how deep the graph traversal goes when building nodes and edges.

## Acceptance Criteria

- [ ] max_depth option limits call graph traversal depth
- [ ] Nodes beyond the specified depth are excluded
- [ ] Edges are only included if both nodes are within depth limit
- [ ] Test 'respects max_depth option' passes
