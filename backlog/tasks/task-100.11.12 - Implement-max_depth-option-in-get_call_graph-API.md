---
id: task-100.11.12
title: Implement max_depth option in get_call_graph API
status: Done
assignee: []
created_date: '2025-08-04 16:43'
updated_date: '2025-08-04 22:56'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

The CallGraphOptions interface includes a max_depth option that should limit the depth of the call graph traversal. This feature is not currently implemented in the adapter, causing one test to fail. The implementation should limit how deep the graph traversal goes when building nodes and edges.

## Acceptance Criteria

- [x] max_depth option limits call graph traversal depth
- [x] Nodes beyond the specified depth are excluded
- [x] Edges are only included if both nodes are within depth limit
- [x] Test 'respects max_depth option' passes

## Implementation Notes

The max_depth option was already implemented in the `build_call_graph_for_display` function in `packages/core/src/call_graph/graph_builder.ts`. The implementation:

1. Uses breadth-first traversal starting from top-level nodes at depth 0
2. Includes nodes up to the specified max_depth
3. Filters both nodes and edges to only include those within the depth limit
4. The test 'respects max_depth option' is passing successfully

No changes were needed as the functionality was already properly implemented.
