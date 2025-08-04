---
id: task-100.11.3
title: Implement immutable call analysis with state passing
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-04 14:17'
updated_date: '2025-08-04 14:56'
labels:
  - immutable
  - refactoring
dependencies: []
parent_task_id: task-100.11
---

## Description

Refactor get_calls_from_definition and get_module_level_calls to use immutable state passing. Instead of mutating type trackers during analysis, return analysis results that include any discovered type information.

## Acceptance Criteria

- [x] Call analysis functions return results with type discoveries
- [x] No mutations during call analysis
- [x] Type information flows through return values
- [x] Constructor detection returns type assignments
- [x] Method resolution is pure functional

## Implementation Plan

1. Analyze current call analysis logic in project_call_graph.ts
   - get_calls_from_definition
   - get_module_level_calls
   - resolve_method_call
2. Create new immutable_call_analysis.ts module
3. Define data structures for analysis results:
   - CallAnalysisResult
   - TypeDiscovery
   - MethodResolutionResult
4. Implement pure functions:
   - analyze_calls_from_definition() - returns calls and type discoveries
   - analyze_module_level_calls() - returns module-level calls
   - resolve_method_call_pure() - resolves method without mutations
5. Handle special cases:
   - Constructor calls that create type assignments
   - Method calls that need type resolution
   - Self/this parameter tracking
6. Ensure type information flows through returns:
   - Return both calls found and types discovered
   - Allow caller to decide how to apply type updates
7. Add unit tests for immutable behavior
8. Update call sites to use new functions

## Implementation Notes

- Created immutable_call_analysis.ts module with pure functional implementation
- Defined CallAnalysisResult that includes both calls found and type discoveries
- TypeDiscovery interface tracks variable type assignments with scope information
- All analysis functions are pure with no side effects:
  - analyze_calls_from_definition() - analyzes calls within a definition
  - analyze_module_level_calls() - finds calls at module scope
  - resolve_method_call_pure() - resolves method calls without mutations
- Constructor detection returns type discoveries for variable assignments
- Method resolution uses immutable type lookups
- Added comprehensive unit tests (9 tests, all passing)
- Type information flows through return values, allowing callers to decide how to apply updates
