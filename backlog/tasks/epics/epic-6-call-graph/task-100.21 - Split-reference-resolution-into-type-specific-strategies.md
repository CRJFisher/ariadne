---
id: task-100.21
title: Split reference resolution into type-specific strategies
status: To Do
assignee: []
created_date: '2025-08-05 21:16'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Break down the complex resolve_reference() function into focused, testable strategies using the Strategy pattern. The current implementation handles multiple reference types (direct references, method calls, static methods, chained calls) in a single large function that is difficult to test and maintain.

## Acceptance Criteria

- [ ] Create DirectReferenceResolver class for simple variable/function references
- [ ] Create MethodCallResolver class for instance method calls
- [ ] Create StaticMethodResolver class for static method calls
- [ ] Create ChainedCallResolver class for method chaining
- [ ] ReferenceResolver orchestrator using strategy pattern to coordinate resolvers
- [ ] Each resolver class under 50 lines with single responsibility
- [ ] Unit tests for each resolver type with comprehensive coverage
