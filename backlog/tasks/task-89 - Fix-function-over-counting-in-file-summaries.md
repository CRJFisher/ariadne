---
id: task-89
title: Fix function over-counting in file summaries
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Function counting is inaccurate, often reporting 2x the actual number of functions in a file. For example, symbol_naming.ts reports 18 functions but only has about 9 exported functions. The counting logic appears to be including duplicates or non-function definitions.

## Acceptance Criteria

- [ ] Function counts match actual function definitions
- [ ] No double-counting of functions
- [ ] Correctly distinguishes functions from other definitions like interfaces

## Implementation Notes

Test cases from validation:
- src/symbol_naming.ts: Reports 18 functions but manual count shows only ~9 exported functions
- The file exports: get_symbol_id, getClassSymbolId, getMethodSymbolId, getFunctionSymbolId, getVariableSymbolId, getPropertySymbolId, getParameterSymbolId, getTypeSymbolId, getNamespaceSymbolId
- Appears to be double-counting or including non-function definitions

The counting should only include actual function declarations, not interfaces or type definitions.
