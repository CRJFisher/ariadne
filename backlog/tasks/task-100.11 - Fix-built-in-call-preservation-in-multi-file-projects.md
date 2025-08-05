---
id: task-100.11
title: Fix built-in call preservation in multi-file projects
status: To Do
assignee: []
created_date: '2025-08-05 11:58'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Built-in calls (console.log, Array.push, etc.) are correctly detected but disappear when multiple files are loaded. Investigation shows that when new files are added to the project, previously analyzed files are not re-analyzed, and cached results don't include built-in calls.

## Acceptance Criteria

- [ ] Built-in calls persist after loading multiple files
- [ ] generateLargeFile retains all 19 built-in calls in validation
- [ ] Validation shows 85%+ nodes with calls

## Technical Context

### Current Behavior
1. When a single file is analyzed, built-in calls are correctly tracked
2. When a second file is added, the call graph is rebuilt
3. During rebuild, previously analyzed files are NOT re-analyzed (no debug output)
4. The cached analysis results don't include the built-in calls
5. Result: functions that had built-in calls now show 0 calls

### Evidence
```
=== Test 1: Load benchmark-incremental.ts ===
Debug lines printed: 19
generateLargeFile calls: 19

=== Test 2: Add graph.ts ===
Debug lines printed: 0  // No re-analysis!
generateLargeFile calls: 0

=== Test 3: Re-add benchmark-incremental.ts (no changes) ===
Debug lines printed: 19
generateLargeFile calls: 19  // Calls come back!
```

### Root Cause
The issue appears to be in how the call graph building process caches analysis results. The `analyze_file` function in `graph_builder.ts` returns `CallAnalysisResult` objects that should contain built-in calls, but these are either:
1. Not being cached properly when the initial analysis happens
2. Being lost during the state update when new files are added
3. Not being included when the call graph is rebuilt from cached data

### Related Code
- `packages/core/src/call_graph/graph_builder.ts` - analyze_file, build_call_graph_for_display
- `packages/core/src/project/call_graph_service.ts` - extractCallGraph, getCallGraph
- `packages/core/src/call_graph/call_analysis.ts` - analyze_calls_from_definition (working correctly)

## Implementation Plan

1. Add logging to track when files are analyzed vs when cached results are used
2. Investigate the immutable state update process when new files are added
3. Check if CallAnalysisResult is being properly stored and retrieved
4. Ensure built-in calls are included in the cached analysis data
5. Add tests for multi-file scenarios with many files (20+)
6. Verify fix with full validation run
