---
id: task-epic-11.15
title: Migrate return_type_inference feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, type-analysis, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `return_type_inference` feature to `src/type_analysis/return_type_inference/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where return_type_inference currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to return_type_inference
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how return_type_inference connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Function Calls**: Infer types from return statements
   - TODO: Analyze function body for returns
2. **Type Tracking**: Update type tracker with inferred types
   - TODO: Register inferred return types
3. **Method Calls**: Infer method return types
   - TODO: Consider class context for methods
4. **Type Propagation**: Propagate inferred types
   - TODO: Flow return types through calls

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface ReturnTypeInferrer { infer_return_type(func: FunctionDef): TypeInfo; }
interface ReturnAnalysis { explicit_returns: TypeInfo[]; inferred_type: TypeInfo; }
```

## Planning Phase

### Folder Structure

- [ ] Determine if sub-folders needed for complex logic
- [ ] Plan file organization per Architecture.md patterns
- [ ] List all files to create

### Architecture Verification

- [ ] Verify against docs/Architecture.md folder patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan dispatcher/marshaler pattern

## Implementation Phase

### Code Migration

- [ ] Create folder structure at src/type_analysis/return_type_inference/
- [ ] Move/create common return_type_inference.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create return_type_inference.test.ts
- [ ] Move/create language-specific test files
- [ ] Ensure all tests pass
- [ ] Add test contract if needed

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [ ] Comprehensive test coverage
- [ ] Follows rules/coding.md standards
- [ ] Files under 32KB limit
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `return_type_inference.ts`:
   ```typescript
   // TODO: Integration with Function Calls
   // - Analyze function body for returns
   // TODO: Integration with Type Tracking
   // - Register inferred return types
   // TODO: Integration with Method Calls
   // - Consider class context for methods
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Type Propagation - Flow return types through calls
   ```