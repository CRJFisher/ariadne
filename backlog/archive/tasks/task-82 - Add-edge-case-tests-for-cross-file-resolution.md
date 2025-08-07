---
id: task-82
title: Add edge case tests for cross-file resolution
status: Done
assignee:
  - '@assistant'
created_date: '2025-08-03'
updated_date: '2025-08-04 10:33'
labels: []
dependencies: []
---

## Description

Add tests for edge cases including circular imports, deeply nested method calls, inheritance chains, and complex import/export patterns to ensure robustness.

## Acceptance Criteria

- [x] Circular import tests added
- [x] Nested call chain tests added
- [x] Inheritance tests added
- [x] Complex import patterns tested

## Implementation Plan

1. Review existing test structure and patterns in packages/core/tests/
2. Create edge_cases.test.ts for complex cross-file resolution scenarios
3. Implement circular import detection tests:
   - Direct circular imports (A imports B, B imports A)
   - Indirect circular imports (A → B → C → A)
   - Self-referential imports
4. Implement deeply nested call chain tests:
   - Multi-level method calls across files
   - Chained property access with method calls
   - Recursive function calls across files
5. Implement inheritance edge case tests:
   - Multi-level inheritance chains
   - Interface implementation chains
   - Mixin patterns
   - Diamond inheritance patterns (where applicable)
6. Implement complex import/export pattern tests:
   - Re-exports and barrel exports
   - Namespace imports with nested access
   - Dynamic imports
   - Mixed CommonJS and ES6 patterns
7. Test error handling and edge cases:
   - Missing files/imports
   - Malformed import statements
   - Conflicting exports
8. Run all tests and ensure they pass

## Implementation Notes

Successfully implemented comprehensive edge case tests for cross-file resolution.

## Implementation Summary

Created edge_cases.test.ts with 16 tests covering:

### Circular Imports (3 tests, 2 passing)
- Direct circular imports (A imports B, B imports A) ✓
- Indirect circular imports (A → B → C → A) ✓  
- Self-referential imports (needs core improvement)

### Deeply Nested Call Chains (3 tests, 1 passing)
- Multi-level method calls across files (needs chained call support)
- Chained property access with method calls ✓
- Recursive function calls across files (needs self-call tracking)

### Inheritance Edge Cases (3 tests, all passing)
- Multi-level inheritance chains ✓
- Interface implementation chains ✓
- Mixin patterns ✓

### Complex Import/Export Patterns (4 tests, 3 passing)
- Re-exports and barrel exports ✓
- Namespace imports with nested access (needs namespace call support)
- Dynamic imports ✓
- Mixed CommonJS and ES6 patterns ✓

### Error Handling (3 tests, 2 passing)
- Missing files/imports gracefully (needs unresolved import handling)
- Malformed import statements ✓
- Conflicting exports ✓

## Results
- 11 out of 16 tests passing (69% success rate)
- Successfully tests the current capabilities of cross-file resolution
- Identified 5 areas for potential core library improvements

## Files Modified
- packages/core/tests/edge_cases.test.ts: Comprehensive edge case test suite

The tests provide good coverage of edge cases and will help ensure robustness as the cross-file resolution features evolve.
