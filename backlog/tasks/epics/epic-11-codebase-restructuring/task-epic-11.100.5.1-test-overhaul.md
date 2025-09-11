# Task 11.100.5.1: Test Overhaul for function_calls

## Parent Task

11.100.5 - Transform function_calls to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the function_calls module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/call_graph/function_calls/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All function call patterns (simple, qualified, dynamic) must have tests
  - All language-specific query patterns (.scm files) must be tested
  - All call types (sync, async, IIFE, closures) must be validated
  - All edge cases (call chains, computed names) must be tested

- [ ] **Language-Specific Test Files**
  - `function_calls.javascript.test.ts` - JS calls, IIFE, arrow functions, async/await
  - `function_calls.typescript.test.ts` - TS typed calls, generic functions, overloads
  - `function_calls.python.test.ts` - Python calls, decorators, lambda, *args/**kwargs
  - `function_calls.rust.test.ts` - Rust calls, closures, macro invocations, associated functions

- [ ] **Test Categories (All Languages)**
  - Simple function calls (func())
  - Qualified calls (module.func())
  - Dynamic calls (obj[name]())
  - Async function calls
  - IIFE patterns
  - Callback functions
  - Higher-order function calls
  - Recursive function calls
  - Call with spread/rest arguments

- [ ] **Edge Case Testing**
  - Function calls in expressions
  - Chained function calls
  - Computed function names
  - Functions as arguments
  - Partial function application
  - Invalid call patterns

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern independently
  - Verify function name extraction accuracy
  - Test argument count calculation
  - Validate call type classification (function vs method)

- [ ] **Integration Testing**
  - Test with complex call graphs from corpus/
  - Verify call site location accuracy
  - Performance benchmarks vs manual detection
  - Cross-file function call resolution

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Function call accuracy >99%** (validated against manual parsing)
- **No false method call detection** (strict function-only filtering)

## Dependencies

- Must be completed BEFORE task 11.100.5 implementation begins
- Works in parallel with task 11.100.5.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
