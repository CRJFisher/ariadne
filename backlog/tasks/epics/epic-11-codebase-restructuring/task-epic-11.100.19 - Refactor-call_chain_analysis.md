---
id: task-epic-11.100.19
title: Refactor call_chain_analysis for unified call types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'call-analysis', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100
priority: medium
---

## Description

Refactor the call_chain_analysis module to use the new unified CallInfo type system.

## Processing Unified CallInfo

The new signature accepts all call types in a single array:

```typescript
// Process calls by kind
calls.forEach(call => {
  switch(call.kind) {
    case 'function':
      // Handle function call
      break;
    case 'method':
      // Handle method call
      break;
    case 'constructor':
      // Handle constructor call
      break;
  }
});
```

Build chains by traversing caller_context relationships.

## Implementation Details

The function `analyze_call_chains` now accepts a unified `CallInfo[]` array instead of separate arrays for function, method, and constructor calls. This simplifies the API and allows for more flexible call chain analysis.

### Key Changes

1. **Unified Input**: Single array of `CallInfo` objects
2. **Discriminated Union**: Use the `kind` field to determine call type
3. **Simplified Processing**: Single loop to process all call types
4. **Better Type Safety**: TypeScript ensures exhaustive handling of all call kinds

## Prerequisites

✅ **Task 11.100.0.5.19.20 completed** - Function signature updated to accept unified `CallInfo[]` array

## Acceptance Criteria

- [x] Function accepts unified `CallInfo[]` array (completed in task 11.100.0.5.19.20)
- [ ] All call types are properly handled
- [ ] Call chains are built correctly
- [ ] Tests pass with new signature

## Implementation Status

The `analyze_call_chains` function has been created with the correct signature:

```typescript
export function analyze_call_chains(
  calls: CallInfo[]
): CallChain[] {
  // TODO: Implement using new query-based system
  // See task 11.100.19 for implementation details
  return [];
}
```

**Location**: `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts:66`

### Next Steps

1. Implement the function body to process the unified `CallInfo[]` array
2. Handle each call type using discriminated union pattern
3. Build call chains by traversing caller relationships
4. Add comprehensive tests for the new implementation