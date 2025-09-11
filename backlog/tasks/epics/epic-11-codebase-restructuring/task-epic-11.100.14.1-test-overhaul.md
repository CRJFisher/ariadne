# Task 11.100.14.1: Test Overhaul for member_access

## Parent Task

11.100.14 - Transform member_access to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the member_access module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `src/ast/member_access/`

## Test Overhaul Requirements

### Comprehensive Test Suite Implementation

- [ ] **Achieve 100% Test Coverage**
  - All member access patterns (dot, bracket, optional) must have tests
  - All language-specific query patterns (.scm files) must be tested
  - All access types (property, field, static) must be validated
  - All edge cases (chained access, computed names) must be tested

- [ ] **Language-Specific Test Files**
  - `member_access.javascript.test.ts` - JS dot/bracket notation, optional chaining (?.), this
  - `member_access.typescript.test.ts` - TS private fields (#), static members, decorators
  - `member_access.python.test.ts` - Python attribute access, dunder methods, descriptors
  - `member_access.rust.test.ts` - Rust field access, deref, tuple access, associated items

- [ ] **Test Categories (All Languages)**
  - Simple member access (obj.prop)
  - Bracket notation (obj["prop"], obj[key])
  - Optional chaining (obj?.prop)
  - Private member access (#private)
  - Static member access (Class.static)
  - Chained access (obj.a.b.c)
  - Computed property access
  - This/self member access
  - Nested object access

- [ ] **Edge Case Testing**
  - Access on null/undefined (with optional chaining)
  - Dynamic property names
  - Symbol property access
  - Prototype chain access
  - Deeply nested access chains
  - Mixed dot/bracket access patterns

- [ ] **Query Pattern Validation**
  - Test each .scm query pattern independently
  - Verify object extraction accuracy
  - Test member name capture completeness
  - Validate chain depth calculation

- [ ] **Integration Testing**
  - Test with complex object hierarchies from corpus/
  - Verify member type resolution accuracy
  - Performance benchmarks vs manual detection
  - Cross-file member access tracking

### Success Criteria (Testing)
- **100% test coverage** (no exceptions)
- **All tests passing** (zero failures, zero skips)
- **Member access accuracy >99%** (validated against manual parsing)
- **Perfect chain tracking** (correct depth calculation)

## Dependencies

- Must be completed BEFORE task 11.100.14 implementation begins
- Works in parallel with task 11.100.14.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
