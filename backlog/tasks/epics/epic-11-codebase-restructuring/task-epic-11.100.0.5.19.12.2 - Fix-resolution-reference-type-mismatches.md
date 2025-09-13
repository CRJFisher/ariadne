---
id: task-epic-11.100.0.5.19.12.2
title: Fix Resolution and ResolvedReference type mismatches
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['type-migration', 'compilation-error', 'resolution']
dependencies: ['task-epic-11.100.0.5.19.12']
parent_task_id: task-epic-11.100.0.5.19.12
priority: high
---

## Description

Fix inconsistent usage of Resolution, ResolvedReference, and SymbolId types throughout the codebase causing compilation errors.

## Type Issues to Resolve

### 1. Resolution vs ResolvedReference Confusion
- `call_chain_analysis.ts` mixing ResolvedReference and SymbolId parameters
- Functions expecting ResolvedReference receiving SymbolId and vice versa
- Type conversion issues between reference types

### 2. Missing resolution_path Property
- Resolution objects missing required `resolution_path` property
- Resolution type structure not matching new interface definition

### 3. SymbolId Type Safety Issues
- Raw string values being assigned to SymbolId (branded type)
- Missing proper type conversions using branded type factories
- Type guard usage inconsistencies

## Specific Errors to Fix

From `call_chain_analysis.ts`:
```
error TS2345: Argument of type 'SymbolId' is not assignable to parameter of type 'ResolvedReference'
error TS2345: Argument of type 'ResolvedReference' is not assignable to parameter of type 'SymbolId'
error TS2322: Type 'string' is not assignable to type 'SymbolId'
error TS2741: Property 'resolution_path' is missing in type '...' but required in type 'Resolution<...>'
```

## Files Requiring Updates

### Primary Files
- `src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- Any other modules using Resolution/ResolvedReference types inconsistently

### Type Definition Verification
- `packages/types/src/query.ts` - Resolution interface
- `packages/types/src/symbol_utils.ts` - SymbolId usage patterns

## Solution Approach

1. **Audit Type Usage**: Review all usages of Resolution, ResolvedReference, SymbolId
2. **Standardize Patterns**: Establish consistent usage patterns for each type
3. **Add Type Guards**: Implement proper type guards and factory functions
4. **Update Implementations**: Fix all type mismatches systematically

## Acceptance Criteria

- [ ] All Resolution objects have required properties
- [ ] Consistent usage of ResolvedReference vs SymbolId
- [ ] Proper branded type handling for SymbolId
- [ ] No compilation errors related to these types
- [ ] Type safety maintained throughout

## Priority

**HIGH** - Blocking compilation and type safety