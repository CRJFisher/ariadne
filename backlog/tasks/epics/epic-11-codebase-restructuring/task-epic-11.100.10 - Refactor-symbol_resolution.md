---
id: task-epic-11.100.10
title: Refactor symbol_resolution module using query-based system
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['ast-processing', 'symbol-analysis', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.14']
parent_task_id: task-epic-11.100
priority: high
---

## Description

Refactor the symbol_resolution module to use the new tree-sitter query-based system for symbol extraction and resolution.

## Current State

The `extract_symbols` function has been created with the new signature returning `SymbolDefinition[]` and is ready for implementation using the query-based system.

## Implementation Plan

### 1. Symbol Extraction Using Queries

Replace manual AST traversal with tree-sitter queries to extract symbols:

```typescript
// queries/symbol_extraction.scm
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params) @function.decl

(variable_declarator
  name: (identifier) @variable.name
  value: (_)? @variable.init) @variable.decl

(class_declaration
  name: (identifier) @class.name
  body: (class_body) @class.body) @class.decl

(method_definition
  key: (property_identifier) @method.name
  parameters: (formal_parameters) @method.params) @method.decl
```

### 2. Symbol Resolution Patterns

Use configuration-driven patterns for symbol resolution:

```typescript
const RESOLUTION_CONFIG = {
  javascript: {
    scope_rules: ['local', 'enclosing', 'module', 'global'],
    hoisting: ['function', 'var'],
    special_symbols: ['this', 'super', 'arguments']
  },
  typescript: {
    extends: 'javascript',
    type_only: true,
    namespaces: true,
    interfaces: true
  },
  python: {
    scope_rules: ['local', 'enclosing', 'global', 'builtin'],
    special_resolution: 'LEGB'
  },
  rust: {
    scope_rules: ['local', 'module', 'crate'],
    visibility: ['pub', 'pub(crate)', 'pub(super)']
  }
};
```

## SymbolDefinition Creation

Use functions from `symbol_scope_types.ts`:

```typescript
const symbol = create_variable_symbol({
  id: to_symbol_id('my_var'),
  name: to_symbol_name('my_variable'),
  scope: to_scope_path('module/function'),
  type_expression: to_type_expression('string'),
  visibility: 'public',
  location,
  language: 'javascript'
});
```

Symbol kinds: variable, function, class, method, parameter

## Tasks

### Phase 1: Query Infrastructure
- [ ] Create language-specific query files for symbol extraction
- [ ] Implement query loader and executor
- [ ] Create symbol capture processing

### Phase 2: Symbol Extraction
- [ ] Implement `extract_symbols` using queries
- [ ] Handle all symbol kinds (function, class, variable, method, parameter)
- [ ] Process symbol attributes (visibility, mutability, etc.)

### Phase 3: Symbol Resolution
- [ ] Convert resolution logic to use extracted symbols
- [ ] Implement scope-aware symbol lookup
- [ ] Handle cross-file symbol resolution

### Phase 4: Testing and Validation
- [ ] Create comprehensive test suite
- [ ] Validate against existing implementation
- [ ] Performance benchmarking

## Expected Benefits

1. **Code Reduction**: ~80% less code through query-based approach
2. **Maintainability**: Declarative queries easier to update
3. **Accuracy**: Tree-sitter queries more reliable than manual traversal
4. **Performance**: Single-pass query execution faster than recursive traversal

## Success Criteria

- [ ] All symbol types correctly extracted
- [ ] Symbol resolution maintains 100% compatibility
- [ ] Performance improved by at least 30%
- [ ] Code coverage remains at 100%
- [ ] All language-specific features preserved

## Notes

- The `extract_symbols` function signature has been updated to return `SymbolDefinition[]`
- Use branded types from `@ariadnejs/types` for type safety
- Maintain backward compatibility during transition