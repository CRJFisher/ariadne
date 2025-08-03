---
id: task-93
title: Fix TypeScript interface and type counting
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The function counting logic appears to be including TypeScript interfaces and type definitions as functions. This inflates the function count in TypeScript files. Need to ensure only actual functions/methods are counted.

## Acceptance Criteria

- [ ] Only actual functions and methods are counted
- [ ] TypeScript interfaces are not counted as functions
- [ ] Type definitions are not counted as functions

## Implementation Plan

1. Test function counting with interfaces and types
2. Verify filtering logic in get_functions_in_file
3. Ensure correct symbol_kind assignment
4. Test with real TypeScript files

## Implementation Notes

Verified that TypeScript interfaces and types are NOT counted as functions.

### Analysis
- get_functions_in_file correctly filters to only: function, method, generator
- Interfaces have symbol_kind='interface'
- Type aliases have symbol_kind='alias'
- These are explicitly excluded from function counting

### Test Results
Test file with:
- 2 regular functions
- 2 methods
- 2 interfaces 
- 2 type aliases
- 2 arrow functions (counted as constants)

Result: 4 functions detected (2 functions + 2 methods)
- Interfaces NOT counted ✓
- Type aliases NOT counted ✓
- Arrow functions not detected as functions (separate issue)

### Verification
- Interfaces correctly identified with symbol_kind='interface'
- Type aliases correctly identified with symbol_kind='alias'
- Filtering logic in get_functions_in_file working as designed

### Conclusion
The system already correctly excludes interfaces and type definitions from function counting. The original validation concern appears to be resolved or was based on the double-counting issue fixed in task-89.
