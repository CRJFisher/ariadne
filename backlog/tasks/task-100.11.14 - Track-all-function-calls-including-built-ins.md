---
id: task-100.11.14
title: Track all function calls including built-ins
status: To Do
assignee: []
created_date: '2025-08-04 19:00'
updated_date: '2025-08-05'
labels: ['bug', 'regression']
dependencies: [100.13]
parent_task_id: task-100.11
---

## Description

Currently, Ariadne only tracks calls to functions defined within the project. This misses calls to built-in functions (console.log, JSON.stringify) and methods on built-in types (string.trim, array.push), resulting in a low nodes-with-calls percentage (36.9% vs 85% threshold).

**UPDATE 2025-08-05**: The implementation of this task was lost during the refactoring (task-100.12). Need to re-implement with comprehensive tests to prevent future regressions.

## Acceptance Criteria

- [x] All function calls are tracked, including built-ins (works for single files)
- [x] Method calls on built-in types are counted (works for single files)
- [ ] Nodes-with-calls percentage improves significantly (still at 34.7%)
- [x] **NEW**: Comprehensive tests added to prevent regression
- [x] **NEW**: Tests must cover console.log, Array methods, JSON methods, Object methods
- [x] **NEW**: Tests must be part of the regular test suite (not just validation)
- [ ] **NEW**: Built-in tracking must work correctly in multi-file projects

## Implementation Plan

1. Modify call analysis to track all AST call expressions
2. Create placeholder definitions for unresolved calls
3. Update call counting logic
4. Test with real codebase to verify improvement

## Regression Note (2025-08-05)

This task was previously completed on 2025-08-04 but the implementation was lost during the major refactoring (task-100.12). The validation run on 2025-08-05 showed:
- Nodes with calls: 34.1% (same as before the fix)
- Built-in calls like console.log are not being tracked
- No tests were found for built-in call tracking

This needs to be re-implemented with proper test coverage to prevent future regressions.

## Current Status (2025-08-05)

Found that the built-in tracking implementation is actually present in the code:
- `analyze_calls_from_definition` correctly creates synthetic definitions for unresolved calls
- `is_reference_called` properly detects call expressions
- Tests pass showing built-in tracking works

However, there's a critical bug:
- **Single file analysis**: Built-in tracking works perfectly (100% nodes with calls)
- **Multi-file analysis**: Built-in calls are lost (only 48.5% nodes with calls)
- The validation uses multi-file analysis, hence the low 34.7% result

The issue appears to be in how the call graph is constructed when multiple files are involved, not in the built-in tracking logic itself.

## Previous Implementation Notes

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