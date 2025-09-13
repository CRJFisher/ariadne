---
id: task-epic-11.100.0.5.19.20.2
title: Fix CallChainNode structure mismatches
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-migration', 'call-analysis', 'data-structures']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100.0.5.19.20
priority: high
---

## Description

Fix compilation errors in call_chain_analysis caused by using deprecated 'caller'/'callee' properties instead of expected CallChainNode structure.

## Issues Found

### Deprecated Properties in CallChainNode
Code is using 'caller'/'callee' properties that don't exist in the new CallChainNode type:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(250,9): error TS2561: Object literal may only specify known properties, but 'caller' does not exist in type 'CallChainNode'. Did you mean to write 'call'?
src/call_graph/call_chain_analysis/call_chain_analysis.ts(299,42): error TS2551: Property 'caller' does not exist on type 'CallChainNode'. Did you mean 'call'?
```

### Test Objects Using Wrong Properties
Test files also use the deprecated structure:

```
src/call_graph/call_chain_analysis/call_chain_analysis.test.ts(365,15): error TS2561: Object literal may only specify known properties, but 'caller' does not exist in type 'CallChainNode'. Did you mean to write 'call'?
```

## Changes Required

### 1. Update CallChainNode Creation

Replace deprecated properties with correct structure:

```typescript
// OLD - Using deprecated properties
const node: CallChainNode = {
  caller: current,
  callee,
  location: call_info?.location || { row: 0, column: 0 },
  file_path: call_info?.file_path || "",
  call_type: determine_call_type(call_info),
  depth: depth + 1,
};

// NEW - Use correct CallChainNode structure (need to check actual type definition)
const node: CallChainNode = {
  call: call_info, // Or appropriate call structure
  depth: depth + 1,
  // Add other required properties based on actual CallChainNode definition
};
```

### 2. Update Property Access

Replace all access to deprecated properties:

```typescript
// OLD
const root = path.length > 0 ? path[0].caller : "<unknown>";
for (const node of chain.nodes) {
  if (seen.has(node.callee)) {
    // ...
  }
  seen.add(node.caller);
}

// NEW - Use correct property access
const root = path.length > 0 ? get_caller_from_node(path[0]) : "<unknown>";
for (const node of chain.nodes) {
  if (seen.has(get_callee_from_node(node))) {
    // ...
  }
  seen.add(get_caller_from_node(node));
}
```

### 3. Check CallChainNode Type Definition

Review the actual CallChainNode type definition in @ariadnejs/types to understand the correct structure.

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`

## Acceptance Criteria

- [ ] All CallChainNode objects use correct property names
- [ ] All property access uses correct CallChainNode structure
- [ ] Helper functions created for extracting caller/callee if needed
- [ ] Code compiles without CallChainNode-related errors
- [ ] Tests updated to use correct CallChainNode structure
- [ ] Chain traversal logic works with new structure