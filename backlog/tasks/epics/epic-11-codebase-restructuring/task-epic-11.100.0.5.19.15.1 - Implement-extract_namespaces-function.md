---
id: task-epic-11.100.0.5.19.15.1
title: Implement extract_namespaces function using query-based system
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['implementation', 'query-system', 'namespace-analysis']
dependencies: ['task-epic-11.100.0.5.19.15', 'task-epic-11.100.16']
parent_task_id: task-epic-11.100.0.5.19.15
priority: high
---

## Description

Implement the actual functionality for the `extract_namespaces` function that was created as a placeholder in task 11.100.0.5.19.15.

## Current State

```typescript
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[] {
  // TODO: Implement using new query-based system
  // See task 11.100.11 for implementation details
  return [];
}
```

## Implementation Requirements

### 1. Query-Based Implementation
- Use tree-sitter queries instead of manual AST traversal
- Create language-specific .scm query files for namespace patterns
- Follow the patterns established in task 11.100.16

### 2. Support All Languages
- JavaScript: `import * as foo from 'module'`
- TypeScript: namespace declarations + imports
- Python: `import module`, `from module import *`
- Rust: `use module::*`, `use module::{*}`

### 3. Return Correct Import Types
- Return `NamespaceImport[]` specifically
- Use proper `NamespaceName` and `ModulePath` branded types
- Include location information

### 4. Integration Points
- Integrate with existing `detect_namespace_imports` function
- Follow configuration patterns from `language_configs.ts`
- Ensure compatibility with module resolution

## Expected Implementation

```typescript
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[] {
  const query = load_namespace_query(language);
  const captures = query.captures(root_node);

  const namespace_imports: NamespaceImport[] = [];

  // Group captures by import statement
  const import_groups = group_captures_by_import(captures);

  for (const group of import_groups) {
    const namespace_import = extract_namespace_import_from_captures(
      group,
      source_code,
      file_path,
      language
    );

    if (namespace_import) {
      namespace_imports.push(namespace_import);
    }
  }

  return namespace_imports;
}
```

## Dependencies

- Query files must be created (see task 11.100.16)
- `load_namespace_query` helper function
- `group_captures_by_import` utility
- `extract_namespace_import_from_captures` processor

## Acceptance Criteria

- [ ] Function returns actual NamespaceImport objects, not empty array
- [ ] Supports all 4 languages (JS, TS, Python, Rust)
- [ ] Uses tree-sitter queries, no manual traversal
- [ ] Integrates with existing namespace detection
- [ ] Includes comprehensive tests
- [ ] Performance is better than existing manual approach

## Testing Requirements

- [ ] Test namespace imports in all supported languages
- [ ] Test edge cases (complex module paths, nested namespaces)
- [ ] Test integration with existing namespace resolution
- [ ] Performance benchmarks vs manual approach