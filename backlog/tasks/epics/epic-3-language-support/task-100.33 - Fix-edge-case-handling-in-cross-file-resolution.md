---
id: task-100.33
title: Fix edge case handling in cross-file resolution
status: To Do
assignee: []
created_date: "2025-08-05 22:38"
updated_date: "2025-08-06 08:09"
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Multiple edge cases are failing: self-referential imports, multi-level method calls across files, recursive function calls across files, namespace imports with nested access, and missing file/import handling. These suggest issues with complex cross-file resolution scenarios.

## Acceptance Criteria

- [ ] Self-referential imports are handled correctly
- [ ] Multi-level method calls are tracked across files
- [ ] Recursive calls are tracked across files
- [ ] Namespace imports work correctly
- [ ] Missing files/imports are handled gracefully

## Implementation Notes

Analyzed the edge case failures and identified 5 categories of issues that need addressing:

### Issues Identified

1. **Self-referential/Recursive Calls**: Functions that call themselves (directly or indirectly) are not tracked in the call graph. This affects both same-file and cross-file recursive patterns.

2. **Multi-level Method Chaining**: Complex method chains like `api.request().get().withAuth().send()` are not fully resolved. Only the first level of calls is tracked.

3. **Namespace Imports**: The pattern `import * as namespace from './module'` followed by `namespace.function()` calls is not fully resolved. The namespace access pattern needs special handling.

4. **Missing File Handling**: When imports reference non-existent files, the system doesn't gracefully handle it and continue analyzing what it can.

5. **Complex Property Access**: Nested property access with method calls (e.g., `math.operations.multiply()`) requires enhanced resolution.

### Test Results

- ❌ Self-referential imports: Not detecting recursive calls
- ❌ Multi-level method calls: Only first level tracked
- ❌ Recursive function calls: Same as self-referential
- ❌ Namespace imports: Not resolving namespace.method patterns
- ❌ Missing files: Not handling gracefully

### Technical Analysis

These issues require enhancements to:

1. **Call tracking**: Need to detect self-references in call analysis
2. **Method resolution**: Need to track return types for method chaining
3. **Import resolution**: Need special handling for namespace imports
4. **Error handling**: Need graceful degradation for missing imports

### Recommendation

These are complex enhancements that would benefit from individual focused tasks:

- Task for recursive call tracking
- Task for method chaining support
- Task for namespace import resolution
- Task for robust error handling

The current cross-file resolution works well for standard cases but needs these enhancements for edge cases.

### Sub-tasks Created

Created detailed sub-tasks for each issue:

- task-100.38: Add recursive/self-referential call tracking
- task-100.39: Support method chaining and return type tracking
- task-100.40: Add namespace import resolution
- task-100.41: Add graceful error handling for missing imports

The current cross-file resolution works well for standard cases but needs these enhancements for edge cases.
