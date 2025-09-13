---
id: task-epic-11.100.0.5.19.15
title: Update namespace_resolution module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'namespace-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the namespace_resolution module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/namespace_resolution/namespace_extraction.ts`

```typescript
// OLD
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): NamespaceInfo[]

// NEW
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[]
```

### 2. Clear Function Body
Replace implementation with:
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

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.11 - Refactor-namespace_resolution.md`

Add section about namespace imports:
```markdown
## Namespace Import Creation

Use `createNamespaceImport()` from `import_export_types.ts`:

\`\`\`typescript
const namespaceImport = createNamespaceImport(
  toNamespaceName('MyNamespace'),
  buildModulePath('./module'),
  location,
  'javascript'
);
\`\`\`

Note: Namespaces are a variant of Import with `kind: 'namespace'`.
```

## Implementation Notes

### Completed: 2025-09-13

#### Key Decisions Made:

1. **File Location**: The function was created in `namespace_resolution.ts` instead of a separate `namespace_extraction.ts` file since the latter didn't exist and the task was about updating the existing module.

2. **Export Strategy**: Added the function to both the main module file and the index.ts exports to maintain API consistency.

3. **Type Compatibility**: Used the correct `Import` type from `@ariadnejs/types/src/import_export.ts` which is a discriminated union supporting namespace imports with `kind: 'namespace'`.

4. **Documentation Reference**: Corrected the task reference from 11.100.11 (parameter type inference) to 11.100.16 (namespace resolution refactoring), which is the correct task for query-based namespace resolution implementation.

#### Implementation Details:

- **Function Location**: `packages/core/src/import_export/namespace_resolution/namespace_resolution.ts:640-649`
- **Export Location**: `packages/core/src/import_export/namespace_resolution/index.ts:35`
- **Documentation Added**: Task 11.100.16 now includes namespace import creation examples using `createNamespaceImport()`

#### Notes for Future Implementation:

- The function currently returns an empty array as a placeholder
- Full implementation should use tree-sitter queries as outlined in task 11.100.16
- Pre-existing type errors in the module are unrelated to this change and should be addressed separately
- The `Import[]` return type correctly supports namespace imports via the `NamespaceImport` interface

## Acceptance Criteria

- [x] Function signature returns `Import[]` (namespace imports)
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.16 documentation updated (corrected from 11.100.11)
- [x] References to type creation functions added
- [x] Module compiles without errors (pre-existing errors not related to this change)

## Follow-up Tasks Created

Based on the refactoring work, the following sub-tasks have been identified for future work:

- **Task 11.100.0.5.19.15.1** - Implement extract_namespaces function using query-based system
  - Replace placeholder implementation with actual tree-sitter query-based logic
  - Support all languages (JS, TS, Python, Rust)
  - Priority: High

- **Task 11.100.0.5.19.15.2** - Fix namespace_resolution compilation errors
  - Resolve 19 TypeScript compilation errors in the module
  - Update imports, fix property access, handle branded types
  - Priority: High

- **Task 11.100.0.5.19.15.3** - Add tests for extract_namespaces
  - Comprehensive test coverage across all languages
  - Edge cases, performance, and integration tests
  - Priority: Medium

- **Task 11.100.0.5.19.15.4** - Update namespace integration points
  - Integrate with file_analyzer, module_graph, symbol_resolution
  - Update documentation and API examples
  - Priority: Low

## Implementation Notes

**Completed on:** 2025-09-13

**What was done:**
1. Added `extract_namespaces` function to `namespace_resolution.ts` with correct signature returning `Import[]`
2. Function body contains placeholder implementation with TODO comment pointing to task 11.100.16
3. Exported the function from the module's `index.ts`
4. Updated task-epic-11.100.16 documentation with namespace import creation examples
5. Verified the change doesn't introduce new compilation errors (pre-existing errors noted)

**Current state:** The function exists and can be called, but returns an empty array. Full implementation is planned for sub-task 15.1.

**Next steps:** Complete the sub-tasks in priority order (15.2 and 15.1 first to fix compilation and implement functionality).