---
id: task-87
title: >-
  Fix cross-file call tracking - functions called from other files show 0
  incoming calls
status: In Progress
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The call graph fails to track when functions are called from other files. For example, extract_function_metadata is called from scope_resolution.ts but shows 0 incoming calls. This causes functions to be incorrectly marked as top-level when they are actually used internally.

## Acceptance Criteria

- [ ] Functions called from other files have incoming_calls count > 0
- [ ] Top-level detection correctly excludes functions that are called internally
- [ ] Cross-file call relationships are accurately tracked in the call graph

## Implementation Plan

1. Analyze why cross-file imports are not being resolved
2. Check if TypeScript/JavaScript files are handled correctly in module resolution
3. Fix path matching issues between absolute and relative paths
4. Test with validation examples

## Implementation Notes

Successfully implemented cross-file call tracking fix for TypeScript/JavaScript imports.

### Problem
- Cross-file function calls showed 0 incoming calls in validation output
- Import resolution wasn't working for TypeScript/JavaScript files with directory prefixes (e.g., 'src/')
- Functions like extract_function_metadata were incorrectly marked as top-level

### Root Cause
1. Missing explicit handling for .ts/.tsx/.js/.jsx files in import resolution
2. Module resolver returned absolute paths, but project stored relative paths
3. Path mismatch prevented import resolution from finding target files

### Solution
1. Added explicit TypeScript/JavaScript handling in import resolution (index.ts:542-548)
2. Added fallback logic to match absolute paths to project files (index.ts:557-570)
3. When absolute path doesn't match, search for project files that end with the same path

### Files Modified
- src/index.ts: Added TS/JS import resolution and path matching logic

### Test Results
- Cross-file calls now correctly tracked (1 edge created for test case)
- extract_function_metadata correctly shows 1 incoming call from build_scope_graph
- Validation metrics show proper function call tracking
- Top-level accuracy improved from 25% to 100% in test cases
