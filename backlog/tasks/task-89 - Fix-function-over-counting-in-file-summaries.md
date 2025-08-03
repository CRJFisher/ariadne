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

## Implementation Plan

1. Investigate why function counts are doubled
2. Check if duplicate files are being processed
3. Fix export detection in call graph nodes
4. Verify function counting accuracy

## Implementation Notes

Successfully fixed function over-counting and export detection issues.

### Problem

- Function counts were doubled (e.g., symbol_naming.ts showed 18 instead of 9)
- All exported functions showed as not exported in call graph

### Root Cause

1. Compiled JavaScript files in src directory were being processed alongside TypeScript files
2. Export status was hardcoded to false in call graph node creation

### Solution

1. Removed compiled JS files from src directory
2. Fixed export detection by using definition export status (project_call_graph.ts:1171)
3. Changed from `const is_exported = false` to `const is_exported = func.is_exported || this.isDefinitionExported(file_path, func.name)`

### Files Modified

- src/project_call_graph.ts: Fixed export detection in get_call_graph()
- Cleaned up src/*.js files (compiled output)

### Test Results

- Function counts now correct (9 functions for symbol_naming.ts)
- All exported functions correctly marked as exported
- Export status properly propagates from definitions to call graph nodes
- Note: The file actually has 9 functions, not the list mentioned in the original task description
