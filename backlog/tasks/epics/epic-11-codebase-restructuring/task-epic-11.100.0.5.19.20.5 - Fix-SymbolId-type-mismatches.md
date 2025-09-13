---
id: task-epic-11.100.0.5.19.20.5
title: Fix SymbolId branded type mismatches
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-migration', 'branded-types', 'call-analysis']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100.0.5.19.20
priority: high
---

## Description

Fix compilation errors in call_chain_analysis caused by type mismatches between string and SymbolId branded types, and between SymbolId and ResolvedReference types.

## Issues Found

### String to SymbolId Mismatches

Code is passing strings where SymbolId is expected:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(92,21): error TS2345: Argument of type 'string' is not assignable to parameter of type 'SymbolId'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(94,23): error TS2345: Argument of type 'string' is not assignable to parameter of type 'SymbolId'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(112,7): error TS2345: Argument of type 'Map<string, Set<string>>' is not assignable to parameter of type 'Map<SymbolId, Set<SymbolId>>'.
```

### SymbolId to ResolvedReference Mismatches

Code is mixing SymbolId and ResolvedReference types:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(497,9): error TS2345: Argument of type 'SymbolId' is not assignable to parameter of type 'ResolvedReference'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(500,21): error TS2345: Argument of type 'ResolvedReference' is not assignable to parameter of type 'SymbolId'.
```

## Changes Required

### 1. Fix Graph Building Type Consistency

Update build_call_graph to use consistent types:

```typescript
// OLD - Using strings for graph keys
function build_call_graph(
  calls: readonly (FunctionCallInfo | MethodCallInfo | ConstructorCallInfo)[]
): Map<string, Set<string>> {
  const graph = new DefaultMap<string, Set<string>>(() => new Set());
  // ...
}

// NEW - Use SymbolId consistently
function build_call_graph(
  calls: readonly CallInfo[]
): Map<SymbolId, Set<SymbolId>> {
  const graph = new DefaultMap<SymbolId, Set<SymbolId>>(() => new Set());
  // ...
}
```

### 2. Fix Symbol Construction

Ensure proper SymbolId creation:

```typescript
// OLD - Raw strings passed to SymbolId parameters
const roots = Array.from(all_callers).filter(
  (caller) => !all_callees.has(caller)
);

// NEW - Use proper SymbolId construction
const roots = Array.from(all_callers).filter(
  (caller) => !all_callees.has(caller)
);
// Ensure caller is already SymbolId or convert properly
```

### 3. Fix ResolvedReference vs SymbolId Usage

Understand the distinction and use appropriate types:

```typescript
// Check if functions expect ResolvedReference or SymbolId
// Update map_get_or_default usage to use correct types

// OLD - Type mismatch
const symbol = map_get_or_default(
  resolution_results.resolved_calls,
  func.location,
  construct_function_symbol(analysis.file_path, func.name) as SymbolId  // May need ResolvedReference
);

// NEW - Use correct type
const symbol = map_get_or_default(
  resolution_results.resolved_calls,
  func.location,
  create_unresolved_reference(construct_function_symbol(analysis.file_path, func.name))
);
```

### 4. Add Type Conversion Utilities

Create helper functions for type conversions:

```typescript
// Helper to convert between SymbolId and ResolvedReference
function symbol_to_resolved_reference(symbol: SymbolId): ResolvedReference {
  // Implementation based on actual ResolvedReference structure
}

function resolved_reference_to_symbol(ref: ResolvedReference): SymbolId {
  return ref.symbol_id;
}
```

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`

## Research Required

- [ ] Review ResolvedReference type definition in @ariadnejs/types
- [ ] Check map_get_or_default expected parameter types
- [ ] Understand when to use SymbolId vs ResolvedReference
- [ ] Review symbol construction utilities available

## Acceptance Criteria

- [ ] All string to SymbolId conversions use proper constructors
- [ ] All SymbolId to ResolvedReference usage is corrected
- [ ] Graph building uses consistent SymbolId types throughout
- [ ] Type conversion utilities created where needed
- [ ] Code compiles without branded type mismatches
- [ ] Symbol resolution logic works correctly with proper types