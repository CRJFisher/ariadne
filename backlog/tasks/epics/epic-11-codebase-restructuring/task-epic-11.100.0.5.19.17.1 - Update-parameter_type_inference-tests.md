---
id: task-epic-11.100.0.5.19.17.1
title: Update parameter_type_inference tests for new return type
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['testing', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.17', 'task-epic-11.100.13']
parent_task_id: task-epic-11.100.0.5.19.17
priority: medium
---

## Description

Update all tests in the parameter_type_inference module to work with the new `Map<SymbolId, TypeDefinition>` return type instead of the old `Map<string, ParameterAnalysis>` type.

## Changes Required

### Files to Update

1. `parameter_type_inference.test.ts` - Core test file
2. `parameter_type_inference.typescript.test.ts` - TypeScript-specific tests
3. Any other test files that call `infer_all_parameter_types`

### Test Updates Needed

1. **Change expected return type assertions**
   - Update from expecting `ParameterAnalysis` objects
   - Update to expect `TypeDefinition` objects mapped by `SymbolId`

2. **Update test data creation**
   - Use `toSymbolId()` for creating symbol identifiers
   - Use `createPrimitiveType()` for creating type definitions

3. **Fix type assertions**
   - Replace string-based parameter names with SymbolId
   - Replace old type interfaces with new TypeDefinition structure

## Example Changes

```typescript
// OLD TEST
expect(result.get('myFunction')).toEqual({
  function_name: 'myFunction',
  parameters: [...],
  inferred_types: new Map([
    ['param1', { param_name: 'param1', inferred_type: 'string', ... }]
  ])
});

// NEW TEST
expect(result.get(toSymbolId('param1'))).toEqual(
  createPrimitiveType(toTypeName('string'), 'javascript')
);
```

## Acceptance Criteria

- [ ] All parameter_type_inference tests updated for new return type
- [ ] Tests use proper SymbolId and TypeDefinition types
- [ ] All tests pass with new implementation
- [ ] No compilation errors in test files
- [ ] Test coverage maintained at current levels