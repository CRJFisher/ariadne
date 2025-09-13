---
id: task-epic-11.100.0.5.19.11.2
title: Fix type_tracking branded type mismatches
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['typescript-error', 'branded-types']
dependencies: ['task-epic-11.100.0.5.19.11']
parent_task_id: task-epic-11.100.0.5.19.11
priority: high
---

## Description

Fix TypeScript compilation errors in type_tracking module related to branded type mismatches and Map type incompatibilities.

## Errors to Fix

### 1. VariableName Branded Type Mismatch
File: `src/type_analysis/type_tracking/type_tracking.ts:1363`

Error:
```
Type 'SymbolId' is not assignable to type '{ __brand: "VariableName"; }'.
```

The `build_type_index` function is trying to use SymbolId where VariableName is expected.

### 2. QualifiedName Map Type Mismatch
File: `src/type_analysis/type_tracking/type_tracking.ts:1376`

Error:
```
Type 'Map<string, VariableType>' is not assignable to type 'ReadonlyMap<QualifiedName, VariableType>'.
```

The function returns a Map with string keys but the expected return type uses QualifiedName branded type.

### 3. VariableType Property Mismatch
File: `src/type_analysis/type_tracking/type_tracking.ts:1363`

Error:
```
Type '{ name: any; type: TypeString; scope_kind: ScopeType; location: any; }' is not assignable to parameter of type 'VariableType'.
Type is missing the following properties: inferred_type, is_reassigned
```

## Solution

1. **Update build_type_index function signature** to use correct branded types
2. **Convert string keys to QualifiedName** using proper builder functions
3. **Add missing VariableType properties** (inferred_type, is_reassigned)
4. **Use proper type conversion utilities** for branded types

## Implementation Steps

1. Import QualifiedName utilities from @ariadnejs/types
2. Update the variables Map to use QualifiedName as key type
3. Add missing properties to VariableType objects
4. Use proper type builders for branded types

## Acceptance Criteria

- [ ] No branded type mismatch errors in build_type_index function
- [ ] Variables Map uses QualifiedName keys correctly
- [ ] VariableType objects have all required properties
- [ ] Function returns correct ReadonlyMap type
- [ ] Type_tracking module compiles successfully