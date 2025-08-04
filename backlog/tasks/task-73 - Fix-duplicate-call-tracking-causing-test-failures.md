---
id: task-73
title: Fix duplicate call tracking causing test failures
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-03'
updated_date: '2025-08-04'
labels: []
dependencies: []
---

## Description

Methods are being processed multiple times (once as 'method' and once as 'function'), leading to duplicate call counts in tests. This is causing several call_graph.test.ts tests to fail with doubled expected values.

## Acceptance Criteria

- [x] Duplicate tracking is eliminated
- [x] Call counts match expected values in tests
- [x] All call_graph.test.ts tests pass

## Implementation Notes

This issue was resolved as part of the cross-file method resolution implementation (tasks 64-70). The duplicate tracking was eliminated when the call graph logic was refactored to properly handle methods vs functions.

All call_graph.test.ts tests are now passing (46 passed, 8 skipped).
