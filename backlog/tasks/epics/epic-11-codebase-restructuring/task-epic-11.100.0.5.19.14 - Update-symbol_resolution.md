---
id: task-epic-11.100.0.5.19.14
title: Update symbol_resolution module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'symbol-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the symbol_resolution module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/scope_analysis/symbol_resolution/symbol_extraction.ts`

```typescript
// OLD
export function extract_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): SymbolInfo[]

// NEW
export function extract_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): SymbolDefinition[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): SymbolDefinition[] {
  // TODO: Implement using new query-based system
  // See task 11.100.10 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.10 - Refactor-symbol_resolution.md`

Add section about SymbolDefinition creation:
```markdown
## SymbolDefinition Creation

Use functions from `symbol_scope_types.ts`:

\`\`\`typescript
const symbol = createVariableSymbol({
  id: toSymbolId('myVar'),
  name: toSymbolName('myVariable'),
  scope: toScopePath('module/function'),
  type_expression: toTypeExpression('string'),
  visibility: 'public',
  location,
  language: 'javascript'
});
\`\`\`

Symbol kinds: variable, function, class, method, parameter
```

## Acceptance Criteria

- [ ] Function signature returns `SymbolDefinition[]`
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.10 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors