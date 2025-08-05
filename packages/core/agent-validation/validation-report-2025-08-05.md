# Validation Report - 2025-08-05

## Summary

Ran validation after major refactoring (task-100.12 - immutable Project class). Found significant issues with call graph accuracy.

## Metrics

- **Nodes with calls**: 34.1% (threshold: 85%) ❌
- **Nodes called by others**: 37.1% (threshold: 85%) ❌
- **Exported nodes**: 25.7%
- **Total functions**: 334
- **Total edges**: 210

## Key Findings

### 1. Built-in Calls Not Tracked ⚠️

The primary issue is that built-in function calls are not being tracked. This severely impacts the "nodes with calls" metric.

Examples of untracked calls:
- `console.log()` - Very common in the codebase
- `Array.prototype` methods (map, filter, forEach, etc.)
- `JSON.parse()`, `JSON.stringify()`
- `Object.keys()`, `Object.values()`
- `String` methods
- `Math` functions
- `Promise` methods

This was supposed to be fixed in task-100.11.14 but the implementation appears to be missing after the refactoring.

### 2. Export Detection Working But Limited

Only 25.7% of nodes show as exported. This might be accurate given that many functions are internal utilities.

### 3. Call Relationships Detected

The good news is that when calls ARE detected, the relationships are tracked correctly:
- 124 functions are called by others (matches edge count)
- Top-level detection is 100% accurate
- Called_by arrays are properly populated

## Root Cause Analysis

The issue stems from the call analysis logic only tracking calls to definitions found in the project, not built-in functions. This was identified and supposedly fixed in task-100.11.14, but the fix is not present in the current codebase.

## Recommended Actions

1. **Immediate**: Re-implement built-in call tracking (task-100.11.14)
2. **Testing**: Add comprehensive tests for built-in call detection
3. **Validation**: After fix, re-run validation to confirm improvement

## Technical Details

The validation script correctly:
- Loads all 44 files
- Builds scope graphs for each file
- Extracts 334 function definitions
- Identifies 210 call edges

The issue is in `analyze_calls_from_definition` in call_analysis.ts which needs to track ALL function calls, not just those that resolve to project definitions.