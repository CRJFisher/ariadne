# Task 11.100.8.1: Test Overhaul for constructor_calls

## Parent Task

11.100.8 - Transform constructor_calls to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the constructor_calls module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/call_graph/constructor_calls/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All constructor detection patterns must have corresponding tests
  - All language-specific query patterns (.scm files) must be tested
  - All edge cases documented in module comments must have tests
  - All error conditions and malformed syntax must be tested

- [ ] **Language-Specific Test Files**
  - `constructor_calls.javascript.test.ts` - JS/TS new expressions, factory methods
  - `constructor_calls.typescript.test.ts` - Generic constructors, decorators
  - `constructor_calls.python.test.ts` - Class instantiation, __init__ patterns
  - `constructor_calls.rust.test.ts` - Struct literals, ::new, smart pointers

- [ ] **Test Categories (All Languages)**
  - Basic constructor calls (new Class())
  - Generic/parameterized constructors
  - Factory method patterns (Class.create())
  - Constructor chaining/delegation
  - Anonymous/inline constructors
  - Error cases (malformed syntax, missing classes)

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern in isolation
  - Verify capture group naming conventions
  - Test query performance with large files (>1000 lines)
  - Validate query results match expected AST nodes

- [ ] **Integration Testing**
  - Test with real-world codebases from corpus/
  - Verify accuracy against manual detection results
  - Test cross-file constructor resolution
  - Performance regression testing vs manual implementation

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Performance tests pass** (query-based faster than manual)
- **Real-world accuracy validation** (matches expected results)

## Dependencies

- Must be completed BEFORE task 11.100.8 implementation begins
- Works in parallel with task 11.100.8.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
