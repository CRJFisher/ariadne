---
id: task-100.8
title: Fix incoming call detection (task-90)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
labels: []
dependencies:
  - task-90
parent_task_id: task-100
---

## Description

The system fails to detect many incoming calls to functions and methods. This directly impacts the 'nodes-called-by-others' metric (currently 65% vs 85% threshold). Example: ScopeGraph.insert_ref shows 0 incoming calls but is called from scope_resolution.ts.

## Acceptance Criteria

- [ ] Incoming calls correctly detected for all functions
- [ ] Cross-file calls properly tracked
- [ ] Nodes-called-by-others percentage improved

## Implementation Plan

1. Investigate current incoming call detection capabilities
2. Identify specific patterns that are not being detected
3. Implement support for method call chains
4. Add return type tracking for methods
5. Test with real codebase to verify improvements

## Implementation Notes

### Investigation Results

Tested incoming call detection and found that the system correctly handles:
1. **Direct method calls**: `obj.method()` ✓
2. **Chained property access**: `this.prop.method()` ✓  
3. **Variable-based calls**: `const x = this.prop; x.method()` ✓

But does NOT handle:
1. **Method call chains**: `obj.getInner().process()` - only detects call to `getInner()`, not `process()` ✗
2. **Complex expressions**: Method calls through function returns or complex expressions ✗

### Root Cause

The main issue is that the system doesn't track return types of methods. When analyzing `outer.getInner().process()`:
- It correctly identifies the call to `getInner()`
- But it cannot determine that `getInner()` returns an `InnerClass` instance
- Therefore, it cannot resolve the subsequent `process()` call

### Current State

- Simple method calls ARE being detected correctly
- The 65% nodes-called-by-others metric is likely due to:
  1. Method call chains (very common pattern)
  2. Calls through function returns
  3. Dynamic or complex call patterns

### Next Steps

To improve incoming call detection, we need to implement:
1. **Return type tracking**: Track what type/class methods return
2. **Multi-step resolution**: Resolve chained calls by tracking intermediate types
3. **Function return analysis**: Analyze function bodies to determine return types
