---
id: task-75
title: Fix failing call_graph.test.ts tests with incorrect call counts
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Several tests in call_graph.test.ts are failing because they expect specific call counts but are getting double due to duplicate tracking. Includes Rust self parameter test (expects 2, gets 8), TypeScript cross-file resolution (expects 2, gets 4), and similar JavaScript test issues.

## Acceptance Criteria

- [ ] Rust self parameter test passes with correct count
- [ ] TypeScript cross-file resolution test passes
- [ ] JavaScript cross-file resolution test passes
- [ ] All call count assertions match expected values
