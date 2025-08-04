---
id: task-100.11.7
title: Migrate and update all tests for immutable implementation
status: In Progress
assignee:
  - '@chuck'
created_date: '2025-08-04 14:19'
updated_date: '2025-08-04 14:20'
labels:
  - immutable
  - testing
  - migration
dependencies: []
parent_task_id: task-100.11
---

## Description

Update all existing tests that rely on the mutable ProjectCallGraph implementation to work with the new immutable approach. This includes unit tests, integration tests, and any test utilities that create or manipulate call graph data. Ensure 100% test coverage is maintained.

## Acceptance Criteria

- [ ] All existing tests pass with immutable implementation
- [ ] Tests are refactored to use immutable patterns
- [ ] Test utilities updated for immutable data structures
- [ ] No test coverage regression
- [ ] Tests verify immutability where appropriate
- [ ] Mock/stub strategies updated for pure functions

## Implementation Plan

1. Identify all tests using call graph functionality
   - call_graph.test.ts
   - call_graph_api.test.ts
   - call_graph_integration.test.ts
   - method-call-detection.test.ts
   - large-file-handling.test.ts
   - cross_file_all_languages.test.ts
   - import_export_comprehensive.test.ts
   - edge_cases.test.ts

2. Create test helpers for immutable patterns
   - Helper to create test ProjectCallGraphData
   - Helper to assert immutability
   - Helper to build test scenarios

3. Update test setup and teardown
   - Replace mutable initialization
   - Use immutable data builders

4. Migrate assertion patterns
   - Replace mutation checks with return value checks
   - Add immutability assertions where needed

5. Update mocking strategies
   - Mock pure functions instead of methods
   - Use immutable test data

6. Verify test coverage
   - Ensure no coverage regression
   - Add new tests for immutable-specific behavior
