---
id: task-epic-11.100.0.5.19.12
title: Update class_detection module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'class-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the class_detection module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/type_analysis/class_detection/class_extraction.ts`

```typescript
// OLD
export function extract_classes(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ClassInfo[]

// NEW
export function extract_classes(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): TypeDefinition[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_classes(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): TypeDefinition[] {
  // TODO: Implement using new query-based system
  // See task 11.100.8 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.8 - Refactor-class_detection.md`

Add section about TypeDefinition creation for classes:
```markdown
## TypeDefinition Creation for Classes

Use functions from `type_analysis_types.ts`:

\`\`\`typescript
const classDef = createClassDefinition({
  name: toTypeName('MyClass'),
  extends: toTypeName('BaseClass'),
  implements: [toTypeName('Interface1')],
  members: [...],
  location,
  language: 'javascript'
});
\`\`\`

Note: Classes are a variant of TypeDefinition with `kind: 'class'`.
```

## Acceptance Criteria

- [ ] Function signature returns `TypeDefinition[]`
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.8 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors