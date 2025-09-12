---
id: task-epic-11.100.0.5.19.11
title: Update type_tracking module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'type-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the type_tracking module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/type_analysis/type_tracking/type_tracking.ts`

```typescript
// OLD
export function track_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): FileTypeTracker

// NEW - update return type
export function track_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TrackedType>
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function track_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TrackedType> {
  // TODO: Implement using new query-based system
  // See task 11.100.7 for implementation details
  return new Map();
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.7 - Refactor-type_tracking.md`

Add section about TrackedType creation:
```markdown
## TrackedType Creation

Use functions from `type_analysis_types.ts`:

\`\`\`typescript
const trackedType = createTrackedType({
  symbol_id: toSymbolId('myVariable'),
  type_expression: toTypeExpression('string'),
  resolved_type: createResolvedType(...),
  location,
  language: 'javascript'
});
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature returns `Map<SymbolId, TrackedType>`
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.7 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors