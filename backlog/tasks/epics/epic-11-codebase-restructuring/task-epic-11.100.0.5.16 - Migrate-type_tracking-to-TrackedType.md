---
id: task-epic-11.100.0.5.16
title: Migrate type_tracking to TrackedType
status: To Do
assignee: []
created_date: '2025-09-12'
labels: ['type-harmonization', 'refactoring']
dependencies: ['task-epic-11.100.0.5.5']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Update the type_tracking module to directly use TrackedType and UnifiedType from the unified type system, eliminating the need for TypeInfo conversion and the complex array-to-single type adapter.

## Background

Currently we have:
- Internal `TypeInfo` with arrays of types per variable
- Public `TypeInfo` as single type
- `convert_type_info_array_to_single()` that creates union types
- `convert_type_map_to_public()` adapter

This is overly complex and loses type precision.

## Acceptance Criteria

- [ ] FileTypeTracker uses `Map<SymbolId, TrackedType>` instead of `Map<string, TypeInfo[]>`
- [ ] Module directly produces TrackedType with Resolution wrapper
- [ ] Proper handling of type flow and narrowing
- [ ] All branded types used (SymbolId, TypeExpression)
- [ ] No intermediate TypeInfo arrays needed
- [ ] Union types handled properly within TrackedType
- [ ] Tests updated to verify TrackedType output

## Implementation Strategy

```typescript
// BEFORE: Internal TypeInfo arrays
export interface FileTypeTracker {
  variable_types: Map<string, TypeInfo[]>;
  // Accumulates multiple types per variable
}

// AFTER: Direct TrackedType usage
export interface FileTypeTracker {
  variable_types: Map<SymbolId, TrackedType>;
  // Single TrackedType per symbol with proper Resolution
  // Union types handled within UnifiedType.type_expression
}
```

## Key Changes

1. **Symbol identification**: Use SymbolId instead of string variable names
2. **Type representation**: Use UnifiedType with TypeExpression for complex types
3. **Flow tracking**: TrackedType includes flow_source for type origin
4. **Union handling**: Build union TypeExpression instead of array of types
5. **Confidence tracking**: Use Resolution pattern with confidence levels

## Benefits

- Eliminates ~100 lines of adapter code
- Preserves type flow information
- Better union type representation
- Cleaner integration with unified type system
- More precise type tracking

## Affected Files

- `packages/core/src/type_analysis/type_tracking/type_tracking.ts`
- `packages/core/src/type_analysis/type_tracking/type_tracking.javascript.ts`
- `packages/core/src/type_analysis/type_tracking/type_tracking.typescript.ts`
- `packages/core/src/type_analysis/type_tracking/type_tracking.python.ts`
- `packages/core/src/type_analysis/type_tracking/type_tracking.rust.ts`
- All type inference modules that feed into type tracking

## Testing Requirements

- Verify type tracking for:
  - Variable declarations with explicit types
  - Type inference from assignments
  - Union types from multiple assignments
  - Type narrowing in conditionals
  - Generic type resolution
- Test all supported languages
- Ensure proper Resolution confidence levels