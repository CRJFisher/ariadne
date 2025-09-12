---
id: task-epic-11.100.0.5.19.20
title: Update call_chain_analysis module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'call-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the call_chain_analysis module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/call_graph/call_chain_analysis/call_chain_builder.ts`

```typescript
// OLD
export function analyze_call_chains(
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[]
): CallChain[]

// NEW
export function analyze_call_chains(
  calls: CallInfo[]
): CallChain[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function analyze_call_chains(
  calls: CallInfo[]
): CallChain[] {
  // TODO: Implement using new query-based system
  // See task 11.100.19 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.19 - Refactor-call_chain_analysis.md`

Add section about processing unified calls:
```markdown
## Processing Unified CallInfo

The new signature accepts all call types in a single array:

\`\`\`typescript
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
\`\`\`

Build chains by traversing caller_context relationships.
```

## Acceptance Criteria

- [ ] Function signature accepts unified `CallInfo[]` array
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.19 documentation updated
- [ ] Module compiles without errors