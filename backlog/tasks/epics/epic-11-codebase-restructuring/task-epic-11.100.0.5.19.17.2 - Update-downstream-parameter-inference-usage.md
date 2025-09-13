---
id: task-epic-11.100.0.5.19.17.2
title: Update downstream modules using parameter_type_inference
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['migration', 'downstream-updates']
dependencies: ['task-epic-11.100.0.5.19.17', 'task-epic-11.100.13']
parent_task_id: task-epic-11.100.0.5.19.17
priority: medium
---

## Description

Update all downstream modules that use `infer_all_parameter_types` to work with the new `Map<SymbolId, TypeDefinition>` return type.

## Files to Update

### 1. file_analyzer.ts
**Issue**: Currently imports and uses `ParameterAnalysis` type and expects old return format.

**Changes needed**:
- Remove import of `ParameterAnalysis` type
- Update variable that stores result of `infer_all_parameter_types`
- Update any code that processes the returned parameter data
- Change from processing `ParameterAnalysis` objects to `TypeDefinition` objects

### 2. index.ts (parameter_type_inference module)
**Issue**: Still exports `ParameterAnalysis` which may no longer be needed.

**Changes needed**:
- Review if `ParameterAnalysis` export is still needed
- Update exports to include new types if needed
- Update comments about what external modules use

## Current Usage Pattern

```typescript
// In file_analyzer.ts
const inferred_parameters = infer_all_parameter_types(
  root_node,
  source_code,
  file.language,
  file_path
); // Returns Map<string, ParameterAnalysis>

// Process each function's parameter analysis
for (const [funcName, analysis] of inferred_parameters) {
  // analysis.parameters, analysis.inferred_types, etc.
}
```

## New Usage Pattern

```typescript
// After update
const inferred_parameters = infer_all_parameter_types(
  root_node,
  source_code,
  file.language,
  file_path
); // Returns Map<SymbolId, TypeDefinition>

// Process each parameter's type definition
for (const [symbolId, typeDefinition] of inferred_parameters) {
  // typeDefinition contains the new type structure
}
```

## Acceptance Criteria

- [ ] file_analyzer.ts updated to work with new return type
- [ ] All imports updated to remove unused types
- [ ] Module exports updated appropriately
- [ ] No compilation errors in downstream modules
- [ ] Functionality maintained - no behavior changes
- [ ] All integration tests pass