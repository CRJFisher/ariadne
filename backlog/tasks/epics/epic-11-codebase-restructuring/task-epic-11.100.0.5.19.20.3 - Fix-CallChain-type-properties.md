---
id: task-epic-11.100.0.5.19.20.3
title: Fix CallChain type missing properties
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-migration', 'call-analysis', 'data-structures']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100.0.5.19.20
priority: high
---

## Description

Fix compilation errors in call_chain_analysis caused by using properties that don't exist in the current CallChain type definition.

## Issues Found

### Missing Properties in CallChain Type

Code is trying to access properties that don't exist in the CallChain type:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(125,55): error TS2339: Property 'max_depth' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(303,5): error TS2353: Object literal may only specify known properties, and 'root' does not exist in type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(447,13): error TS2339: Property 'max_depth' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(460,15): error TS2339: Property 'is_recursive' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(460,37): error TS2339: Property 'cycle_point' does not exist on type 'CallChain'.
```

### Wrong Return Type Structure

Function is returning wrong structure for CallGraph:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(624,5): error TS2740: Type 'Set<SymbolId>' is missing the following properties from type 'readonly SymbolId[]': length, concat, join, slice, and 14 more.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(625,5): error TS2740: Type 'CallChainAnalysisResult' is missing the following properties from type 'readonly CallChain[]': length, concat, join, slice, and 19 more.
```

## Changes Required

### 1. Check CallChain Type Definition

Review the actual CallChain type in @ariadnejs/types to understand available properties:

```typescript
// Check what properties are actually available in CallChain
interface CallChain {
  // Document actual structure here
}
```

### 2. Update CallChain Creation

Fix object creation to match actual type:

```typescript
// OLD - Using non-existent properties
return {
  root,  // Does not exist
  nodes: [...path],
  is_recursive,  // May not exist
  max_depth,     // May not exist
  cycle_point,   // May not exist
};

// NEW - Use actual CallChain structure
return {
  // Use actual properties from CallChain type definition
  nodes: [...path],
  // Add other required properties
};
```

### 3. Update Property Access

Replace all access to non-existent properties:

```typescript
// OLD
for (const chain of chains) {
  max_chain_depth = Math.max(max_chain_depth, chain.max_depth);
}

if (chain.is_recursive && chain.cycle_point) {
  recursive_funcs.add(chain.cycle_point);
}

// NEW - Use available properties or calculate values
for (const chain of chains) {
  const depth = calculate_chain_depth(chain);
  max_chain_depth = Math.max(max_chain_depth, depth);
}

if (is_recursive_chain(chain)) {
  const cycle_point = find_cycle_point(chain);
  if (cycle_point) {
    recursive_funcs.add(cycle_point);
  }
}
```

### 4. Fix Return Type Issues

Update CallGraph creation to match expected structure:

```typescript
// Fix entry_points to be array, not Set
const graph: CallGraph = {
  nodes: new Map(),
  edges: [],
  entry_points: Array.from(all_callers).filter(c => !all_callees.has(c)),
  call_chains: chains
};
```

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`

## Research Required

- [ ] Review CallChain type definition in @ariadnejs/types
- [ ] Review CallGraph type definition in @ariadnejs/types
- [ ] Check if properties were renamed or moved to different interfaces

## Acceptance Criteria

- [ ] All CallChain object creation uses correct properties
- [ ] All CallChain property access uses available properties
- [ ] Helper functions created for missing functionality (depth calculation, recursion detection)
- [ ] CallGraph creation matches expected type structure
- [ ] Code compiles without CallChain/CallGraph type errors
- [ ] Functionality is preserved with new type structure