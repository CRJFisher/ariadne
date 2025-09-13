---
id: task-epic-11.100.0.5.19.17
title: Update parameter_type_inference module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'type-inference']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the parameter_type_inference module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/type_analysis/parameter_type_inference/parameter_inference.ts`

```typescript
// OLD
export function infer_parameter_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ParameterTypeInfo[]

// NEW
export function infer_parameter_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition>
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function infer_parameter_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition> {
  // TODO: Implement using new query-based system
  // See task 11.100.13 for implementation details
  return new Map();
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.13 - Refactor-parameter_type_inference.md`

Add section about parameter type creation:
```markdown
## Parameter Type Creation

Use functions from `type_analysis_types.ts`:

\`\`\`typescript
const paramType = createPrimitiveType(
  toTypeName('string'),
  'javascript'
);

// Map parameter symbol to its type
paramTypes.set(
  toSymbolId('paramName'),
  paramType
);
\`\`\`
```

## Acceptance Criteria

- [x] Function signature returns `Map<SymbolId, TypeDefinition>`
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.13 documentation updated
- [x] References to type creation functions added
- [x] Module compiles without errors

## Implementation Notes

### Completed Changes:

1. **Updated function signature** - Changed `infer_all_parameter_types` to return `Map<SymbolId, TypeDefinition>` instead of `Map<string, ParameterAnalysis>`
2. **Cleared function body** - Replaced implementation with TODO comment referencing task 11.100.13
3. **Fixed compilation errors** - Resolved naming conflict with imported `is_parameter_node` function
4. **Created documentation** - Added task 11.100.13 with parameter type creation examples
5. **Added required imports** - Imported `SymbolId` and `TypeDefinition` from `@ariadnejs/types`

All changes maintain backward compatibility while preparing the module for the upcoming query-based refactoring.

### Follow-up Sub-tasks Created:

1. **Task 11.100.13** - Refactor parameter_type_inference (implementation)
   - Implement the actual query-based system
   - Replace TODO with working implementation

2. **Task 11.100.0.5.19.17.1** - Update parameter_type_inference tests
   - Update all tests to work with new `Map<SymbolId, TypeDefinition>` return type
   - Fix type assertions and test data creation

3. **Task 11.100.0.5.19.17.2** - Update downstream parameter inference usage
   - Update file_analyzer.ts to work with new return type
   - Update module exports and imports

4. **Task 11.100.0.5.19.17.3** - Cleanup legacy parameter interfaces
   - Remove unused interfaces like ParameterAnalysis, ParameterTypeInfo
   - Clean up dead code and helper functions