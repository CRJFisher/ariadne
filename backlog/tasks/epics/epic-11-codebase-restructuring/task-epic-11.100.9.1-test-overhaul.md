# Task 11.100.9.1: Test Overhaul for symbol_resolution

## Parent Task

11.100.9 - Transform symbol_resolution to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the symbol_resolution module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/scope_analysis/symbol_resolution/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All symbol types (local, parameter, member, import) must have tests
  - All language-specific query patterns (.scm files) must be tested
  - All scope resolution rules must be validated
  - All shadowing scenarios must be tested

- [ ] **Language-Specific Test Files**
  - `symbol_resolution.javascript.test.ts` - JS var hoisting, function scope, closure
  - `symbol_resolution.typescript.test.ts` - TS namespaces, type/value separation
  - `symbol_resolution.python.test.ts` - Python LEGB rules, global/nonlocal
  - `symbol_resolution.rust.test.ts` - Rust ownership, borrow checker integration

- [ ] **Test Categories (All Languages)**
  - Local variable definitions and references
  - Function parameter resolution
  - Class/struct member access
  - Import/module symbol resolution
  - Scope hierarchy traversal
  - Symbol shadowing (inner scope hiding outer)
  - Cross-scope references
  - Unresolved symbol detection

- [ ] **Edge Case Testing**
  - Hoisting behavior (JavaScript)
  - Destructuring patterns
  - Namespace collisions
  - Forward references
  - Circular dependencies
  - Dynamic symbol creation

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern independently
  - Verify capture group hierarchy
  - Test scope boundary detection accuracy
  - Validate reference-to-definition linking

- [ ] **Integration Testing**
  - Test with complex nested scope structures
  - Verify with real-world codebases from corpus/
  - Cross-file symbol resolution testing
  - Performance benchmarks vs manual resolution

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Scope resolution accuracy >99%** (validated against known correct results)
- **Performance improvement demonstrated** (queries faster than manual)

## Dependencies

- Must be completed BEFORE task 11.100.9 implementation begins
- Works in parallel with task 11.100.9.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
