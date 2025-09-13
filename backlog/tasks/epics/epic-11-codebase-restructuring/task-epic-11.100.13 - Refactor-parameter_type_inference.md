---
id: task-epic-11.100.13
title: Refactor parameter_type_inference module
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-inference', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.17']
parent_task_id: task-epic-11.100
priority: medium
---

## Description

Refactor the parameter_type_inference module to use the new query-based system and type definitions.

## Parameter Type Creation

Use functions from `type_analysis_types.ts`:

```typescript
const paramType = createPrimitiveType(
  toTypeName('string'),
  'javascript'
);

// Map parameter symbol to its type
paramTypes.set(
  toSymbolId('paramName'),
  paramType
);
```

## Implementation Details

- Use tree-sitter queries to extract parameter information
- Return Map<SymbolId, TypeDefinition> instead of old parameter types
- Leverage configuration-driven approach for common patterns
- Apply bespoke handlers only where necessary

## Acceptance Criteria

- [ ] Module uses tree-sitter queries for extraction
- [ ] Returns Map<SymbolId, TypeDefinition>
- [ ] All tests pass
- [ ] No TypeScript compilation errors