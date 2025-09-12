---
id: task-epic-11.100.0.5.19.18
title: Update return_type_inference module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'type-inference']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the return_type_inference module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/type_analysis/return_type_inference/return_inference.ts`

```typescript
// OLD
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ReturnTypeInfo[]

// NEW
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition>
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition> {
  // TODO: Implement using new query-based system
  // See task 11.100.14 for implementation details
  return new Map();
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.14 - Refactor-return_type_inference.md`

Add section about return type creation:
```markdown
## Return Type Creation

Use functions from `type_analysis_types.ts`:

\`\`\`typescript
const returnType = createObjectType({
  properties: new Map([
    ['value', createPrimitiveType(toTypeName('number'))],
    ['success', createPrimitiveType(toTypeName('boolean'))]
  ]),
  language: 'javascript'
});

// Map function symbol to its return type
returnTypes.set(
  toSymbolId('functionName'),
  returnType
);
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature returns `Map<SymbolId, TypeDefinition>`
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.14 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors