---
id: task-73
title: Fix duplicate call tracking causing test failures
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Methods are being processed multiple times (once as 'method' and once as 'function'), leading to duplicate call counts in tests. This is causing several call_graph.test.ts tests to fail with doubled expected values.

## Acceptance Criteria

- [ ] Duplicate tracking is eliminated
- [ ] Call counts match expected values in tests
- [ ] All call_graph.test.ts tests pass
