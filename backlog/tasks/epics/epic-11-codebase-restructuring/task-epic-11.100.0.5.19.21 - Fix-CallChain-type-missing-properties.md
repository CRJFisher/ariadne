---
id: task-epic-11.100.0.5.19.21
title: Fix CallChain type missing properties
status: To Do
assignee: []
created_date: "2025-01-13"
labels: ["type-system", "call-analysis"]
dependencies: ["task-epic-11.100.0.5.19.2"]
parent_task_id: task-epic-11.100.0.5.19.2
priority: high
---

## Description

Add missing properties to CallChain type that are referenced in call_chain_analysis module but don't exist in the type definition.

## Missing Properties

The following properties are used in the code but missing from CallChain type:

1. `max_depth: number` - Maximum depth of the call chain
2. `is_recursive: boolean` - Whether the chain contains recursive calls
3. `cycle_point: SymbolId` - Point where recursion/cycle occurs
4. `root: CallChainNode` - Root node of the call chain

## Files to Update

### CallChain Type Definition
File: `packages/types/src/call_chains.ts`

Add missing properties to CallChain interface:
```typescript
export interface CallChain {
  readonly nodes: ReadonlyArray<CallChainNode>;
  readonly depth: number;
  readonly max_depth: number;           // ADD
  readonly is_recursive: boolean;       // ADD
  readonly cycle_point?: SymbolId;      // ADD
  readonly root: CallChainNode;         // ADD
}
```

## Error Examples

Current build errors that will be fixed:
```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(112,55): error TS2339: Property 'max_depth' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(294,5): error TS2353: Object literal may only specify known properties, and 'root' does not exist in type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(438,13): error TS2339: Property 'max_depth' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(451,15): error TS2339: Property 'is_recursive' does not exist on type 'CallChain'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(451,37): error TS2339: Property 'cycle_point' does not exist on type 'CallChain'.
```

## Acceptance Criteria

- [ ] CallChain type includes all missing properties
- [ ] Properties have correct types and readonly modifiers
- [ ] Optional properties marked appropriately (cycle_point)
- [ ] call_chain_analysis module compiles without property errors
- [ ] Type definitions are consistent with usage patterns

## Implementation Notes

- `max_depth` should be a calculated property based on chain analysis
- `is_recursive` indicates presence of cycles in the call graph
- `cycle_point` is optional and only set when recursion is detected
- `root` should reference the starting node of the chain