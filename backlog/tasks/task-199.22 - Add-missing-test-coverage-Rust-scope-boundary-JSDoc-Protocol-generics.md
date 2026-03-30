---
id: TASK-199.22
title: "Add missing test coverage: Rust scope boundary, JSDoc, Protocol, generics"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - testing
  - test-coverage
dependencies: []
references:
  - packages/core/src/index_single_file/scopes/
  - packages/core/src/index_single_file/query_code_tree/extract_nested_definitions.test.ts
  - packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.test.ts
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Test coverage gaps identified during the task-199 epic review that were not addressed because they were lower priority than the primary deliverables.

### Rust scope boundary extractor unit tests

No `rust_scope_boundary_extractor.test.ts` unit test file exists. Python, TypeScript, and JS each have their own extractor unit tests, but Rust scope boundaries are only tested through integration tests in `scopes.test.ts`. Found in task 199.5.

### JSDoc constructor property types

`capture_handlers.javascript.test.ts` has a `it.skip` for "should extract type from JSDoc on constructor assignment (not yet implemented)". This is a documented extraction gap — JSDoc type annotations on constructor-assigned properties are not captured. Found in task 199.1.

### Python Protocol method parameters

`extract_nested_definitions.test.ts` mentions Python Protocol-style classes as a gap but no test was added. Found in task 199.10.

### Rust generic and pattern parameters

`extract_nested_definitions.test.ts` mentions Rust generic parameters and pattern parameters as gaps but no tests were added. Found in task 199.10.

### Rust `is_self_parameter` positive case

The Rust `is_self_parameter` test only exercises negative cases. The test found the `self_parameter` node but didn't call `is_self_parameter` on it — only non-self parameters are tested. Found in task 199.3.

### Actions

1. Create `rust_scope_boundary_extractor.test.ts` with unit tests for Rust-specific boundary extraction (mod blocks, impl blocks, closures, control flow)
2. Implement JSDoc constructor property type extraction (or convert the skip to a backlog reference if out of scope)
3. Add Python Protocol method parameter test to `extract_nested_definitions.test.ts`
4. Add Rust generic parameter and pattern parameter tests to `extract_nested_definitions.test.ts`
5. Fix `is_self_parameter` test to include a positive case
<!-- SECTION:DESCRIPTION:END -->
