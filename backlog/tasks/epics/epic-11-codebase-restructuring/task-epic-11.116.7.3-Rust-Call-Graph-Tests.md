# Task epic-11.116.7.3: CREATE Rust call_graph Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** 116.7.0
**Language:** Rust
**Priority:** High
**Estimated Effort:** 2 hours

## Objective

CREATE NEW integration test file for Rust call graph detection.

## New Test File

**Location:** `packages/core/src/trace_call_graph/detect_call_graph.rust.test.ts`

## Test Coverage

- [ ] Function calls
- [ ] Method calls on structs (impl blocks)
- [ ] Associated function calls (::new)
- [ ] Closure calls
- [ ] Trait method calls
- [ ] Entry point detection (fn main())

## Deliverables

- [ ] NEW test file created
- [ ] Rust-specific call patterns tested
- [ ] All tests passing
