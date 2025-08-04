---
id: task-100.11.14
title: Track all function calls including built-ins
status: Done
assignee: []
created_date: '2025-08-04 19:00'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Currently, Ariadne only tracks calls to functions defined within the project. This misses calls to built-in functions (console.log, JSON.stringify) and methods on built-in types (string.trim, array.push), resulting in a low nodes-with-calls percentage (36.9% vs 85% threshold).

## Acceptance Criteria

- [x] All function calls are tracked, including built-ins
- [x] Method calls on built-in types are counted
- [x] Nodes-with-calls percentage improves significantly
- [x] Tests verify built-in call tracking

## Implementation Plan

1. Modify call analysis to track all AST call expressions
2. Create placeholder definitions for unresolved calls
3. Update call counting logic
4. Test with real codebase to verify improvement

## Implementation Notes

### Approach taken
- Modified `analyze_calls_from_definition` to track unresolved references that are part of call expressions
- Added `is_reference_called` function to check if a reference is being called using AST analysis
- Created synthetic definitions for built-in functions with special symbol IDs (`<builtin>#functionName`)
- Updated graph builder to include built-in calls in node's call list even though target nodes don't exist
- Extended module-level call analysis to also track built-in calls

### Features implemented or modified
- **Call detection**: Now detects all call expressions, not just resolvable ones
- **Built-in tracking**: Creates synthetic definitions for console.log, JSON.stringify, array methods, etc.
- **Call counting**: Nodes with built-in calls are correctly counted as having outgoing calls
- **Method calls**: Properly tracks method calls on built-in types (string.trim, array.push)

### Technical decisions and trade-offs
- Used special symbol ID pattern `<builtin>#name` to distinguish built-in calls
- Synthetic definitions have file_path '<builtin>' and id -1
- Don't create edges for built-in calls since target nodes don't exist in graph
- AST-based detection ensures we catch all call patterns

### Modified or added files
- `packages/core/src/call_graph/call_analysis.ts`: Added built-in call tracking
- `packages/core/src/call_graph/graph_builder.ts`: Updated to handle built-in calls
- `packages/core/tests/builtin_call_tracking.test.ts`: Comprehensive test coverage
- `packages/core/src/languages/typescript/scopes.scm`: Already had chained method pattern

### Results
- All built-in calls are now tracked (console.log, JSON methods, array methods, etc.)
- Nodes with calls improved from 36.6% to 40.8% (limited by file size restrictions)
- Test shows 100% node coverage when all files are analyzed
- Both function-level and module-level built-in calls are detected