---
id: task-100.12
title: Investigate low nodes-called-by-others percentage (37% vs 85%)
status: To Do
assignee: []
created_date: '2025-08-05 12:00'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Even with built-in call tracking fixed, only 37% of nodes are called by others versus the 85% threshold. Need to investigate why so many functions appear to be uncalled in the Ariadne codebase.

## Acceptance Criteria

- [ ] Identify why functions appear uncalled
- [ ] Determine if this is a detection issue or architectural reality
- [ ] Implement fixes if detection issues found
- [ ] Achieve 85%+ nodes-called-by-others metric

## Technical Context

### Potential Causes

1. **Export Detection Issues**
   - Functions that are exported but not called within the project
   - Missing CommonJS export patterns (task-100.9)
   - ES6 export patterns in .js files not detected

2. **Cross-File Call Detection**
   - Imports not being properly resolved
   - Dynamic imports not tracked
   - Re-exports not followed

3. **Test Files**
   - Test functions are typically not called by production code
   - May need to exclude test files from this metric

4. **Entry Points**
   - Main/index files, CLI entry points have no callers
   - Event handlers, callbacks may not show direct calls

5. **Method Calls**
   - Class methods called through instances may not be tracked
   - Prototype methods might be missed

### Investigation Approach

1. Sample uncalled functions from validation output
2. Manually verify if they are actually called
3. Categorize the types of uncalled functions
4. Identify patterns in what's being missed
5. Implement targeted fixes

### Related Tasks
- task-100.9: Add CommonJS and ES6 export support
- task-30: Export detection improvements
