---
id: task-100.1
title: Fix low nodes-with-calls percentage (36.9% vs 85% threshold)
status: To Do
assignee: []
created_date: '2025-08-04 11:54'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The validation shows only 36.9% of nodes have outgoing calls, but the threshold is 85%. This suggests many function calls are not being detected properly.

## Acceptance Criteria

- [ ] Nodes with calls percentage >= 85%
- [ ] Add test cases for missed calls
- [ ] Root cause identified and fixed

## Implementation Plan

1. Investigate what calls are being detected vs missed
2. Identify patterns of undetected calls
3. Determine if external/built-in calls should be counted
4. Implement solution based on findings

## Implementation Notes

### Root Cause Identified

The system only detects calls to functions/methods defined within the project. It does NOT detect:

1. **Calls to built-in functions**: `console.log()`, `JSON.stringify()`, etc.
2. **Method calls on built-in types**: `string.toUpperCase()`, `array.push()`, `number.toFixed()`
3. **Calls to external libraries**: Any npm package functions

### Current Behavior

Testing shows:
- Internal function calls ARE detected: `helperFunction()` ✓
- Internal method calls ARE detected: `this.helper()` ✓  
- External/built-in calls are NOT detected: `console.log()`, `str.trim()` ✗

### Impact

This explains the 36.9% metric - most functions in real code call built-in methods:
- String methods: `trim()`, `split()`, `toLowerCase()`, etc.
- Array methods: `push()`, `map()`, `filter()`, etc.
- Console methods: `log()`, `error()`, `warn()`
- Object methods: `hasOwnProperty()`, `toString()`

### Solution Options

1. **Accept current behavior**: Only track project-internal calls (may need to adjust threshold)
2. **Track all calls**: Count calls to any identifier marked as a function call in AST
3. **Hybrid approach**: Track internal calls + common built-ins

### Recommendation

The 85% threshold seems to assume ALL function calls are tracked, including built-ins. We should either:
- Implement tracking of all function/method calls (regardless of definition location)
- OR adjust the threshold to reflect that only internal calls are tracked
