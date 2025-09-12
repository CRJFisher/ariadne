---
id: task-epic-11.100.0.5.19.13
title: Update scope_tree module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the scope_tree module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/scope_analysis/scope_tree/scope_tree_extraction.ts`

```typescript
// OLD
export function build_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ScopeTree

// NEW
export function build_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ScopeDefinition
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function build_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): ScopeDefinition {
  // TODO: Implement using new query-based system
  // See task 11.100.9 for implementation details
  return createGlobalScope(file_path);
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.9 - Refactor-scope_tree.md`

Add section about ScopeDefinition creation:
```markdown
## ScopeDefinition Creation

Use functions from `symbol_scope_types.ts`:

\`\`\`typescript
const scope = createFunctionScope({
  path: toScopePath('module/function'),
  symbols: new Map(),
  children: [],
  parent: parentScope,
  location,
  language: 'javascript'
});
\`\`\`

Scope types: global, module, class, function, block
```

## Acceptance Criteria

- [ ] Function signature returns `ScopeDefinition`
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.9 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors