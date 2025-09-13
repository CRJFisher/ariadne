---
id: task-epic-11.100.9
title: Refactor scope_tree module
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['refactoring', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.13']
priority: high
---

## Description

Refactor the scope_tree module to use the new query-based system with ScopeDefinition types.

## Implementation Plan

1. Update scope tree construction to use query-based patterns
2. Integrate with new type system using ScopeDefinition/Scope types
3. Maintain compatibility with existing consumers

## ScopeDefinition Creation

Use functions from `symbol_scope_types.ts`:

```typescript
const scope = create_function_scope({
  path: to_scope_path('module/function'),
  symbols: new Map(),
  children: [],
  parent: parentScope,
  location,
  language: 'javascript'
});
```

Scope types: global, module, class, function, block

## Helper Functions

```typescript
// Create different scope types
export function create_global_scope(file_path: FilePath): Scope;
export function create_module_scope(name: string, parent: Scope): Scope;
export function create_class_scope(name: string, parent: Scope): Scope;
export function create_function_scope(name: string, parent: Scope): Scope;
export function create_block_scope(parent: Scope): Scope;
```

## Query-Based Pattern

Use tree-sitter queries to extract scope information:

```scheme
; Function scope
(function_declaration
  name: (identifier) @function.name) @function.scope

; Class scope
(class_declaration
  name: (identifier) @class.name) @class.scope

; Block scope
(block_statement) @block.scope
```

## Acceptance Criteria

- [ ] Query patterns defined for all scope types
- [ ] ScopeDefinition creation helpers implemented
- [ ] Integration with new type system complete
- [ ] All existing tests passing
- [ ] Documentation updated