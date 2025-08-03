---
id: task-90
title: Fix incoming call detection for methods and functions
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The system fails to detect incoming calls to many functions. For example, ScopeGraph.insert_ref shows 0 incoming calls but is actually called from scope_resolution.ts:425. This affects both methods and regular functions.

## Acceptance Criteria

- [ ] All incoming calls to functions are detected
- [ ] Method calls are properly tracked as incoming calls
- [ ] Call counts match actual usage in codebase

## Implementation Notes

Test cases from validation:
- ScopeGraph.insert_ref: Shows 0 incoming calls but is called from scope_resolution.ts:425
- extract_typescript_function_metadata: Reports 2 incoming calls from extract_function_metadata but only 1 actual call at line 20

The system is missing method calls and sometimes over-reporting. Need to ensure all call sites are detected accurately.
