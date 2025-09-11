# Task 11.100.6.1: Test Overhaul for method_calls

## Parent Task

11.100.6 - Transform method_calls to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the method_calls module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/call_graph/method_calls/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All method call patterns (simple, chained, optional) must have tests
  - All language-specific query patterns (.scm files) must be tested
  - All receiver types (objects, classes, modules) must be validated
  - All edge cases (computed methods, dynamic calls) must be tested

- [ ] **Language-Specific Test Files**
  - `method_calls.javascript.test.ts` - JS methods, chaining, optional chaining (?.)
  - `method_calls.typescript.test.ts` - TS typed methods, generic methods, decorators
  - `method_calls.python.test.ts` - Python methods, dunder methods, self/cls patterns
  - `method_calls.rust.test.ts` - Rust impl methods, trait calls, associated functions

- [ ] **Test Categories (All Languages)**
  - Simple method calls (obj.method())
  - Chained method calls (obj.method1().method2())
  - Optional chaining (obj?.method())
  - Static method calls (Class.method())
  - Super method calls (super.method())
  - Dynamic method calls (obj[name]())
  - Computed property methods
  - Method calls with complex receivers
  - Nested method calls

- [ ] **Edge Case Testing**
  - Methods on primitive types
  - Methods on null/undefined (with optional chaining)
  - Method calls in expressions
  - Recursive method calls
  - Method calls with spread arguments
  - Methods vs function calls disambiguation

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern independently
  - Verify receiver extraction accuracy
  - Test method name capture completeness
  - Validate chaining detection logic

- [ ] **Integration Testing**
  - Test with complex object hierarchies from corpus/
  - Verify receiver type resolution accuracy
  - Performance benchmarks vs manual detection
  - Cross-file method resolution testing

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Method call accuracy >99%** (validated against manual parsing)
- **Perfect method/function call distinction** (no false classification)

## Dependencies

- Must be completed BEFORE task 11.100.6 implementation begins
- Works in parallel with task 11.100.6.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
