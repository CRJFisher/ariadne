---
id: task-epic-11.32.3
title: Add FileMetadata type for analysis functions
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [types, graph-builder, epic-11]
dependencies: [task-epic-11.32]
parent_task_id: task-epic-11.32
---

## Description

Create a proper FileMetadata type in packages/types that standardizes the metadata passed to all analysis functions (build_scope_tree, resolve_imports, detect_exports, etc.). Currently the graph_builder creates an inline object `{ language: Language, file_path: string }` that should be properly typed.

## Context

The graph_builder orchestration layer passes metadata to every analysis function:
```typescript
const metadata = {
  language: file.language,
  file_path: file.file_path,
};

// Used in:
const scopes = build_scope_tree(file.tree!, metadata);
const imports = resolve_imports(file.tree!, metadata);
const exports = detect_exports(file.tree!, metadata);
// ... etc
```

This pattern is repeated throughout but lacks type safety. A proper type would:
1. Ensure consistency across all analysis functions
2. Provide a single place to extend metadata when needed
3. Enable type checking for metadata consumers
4. Document what metadata is available to analysis functions

## Tasks

### Phase 1: Design & Create Type
- [ ] Create FileMetadata interface in packages/types
- [ ] Include core fields: language, file_path
- [ ] Consider optional fields that might be useful:
  - source_code?: string (some analyses need raw source)
  - ast_root?: Tree (avoid passing tree separately)
  - scope_tree?: ScopeTree (for functions that need it)

### Phase 2: Update Function Signatures
- [ ] Update all analysis function signatures to use FileMetadata
  - [ ] build_scope_tree(tree: Tree, metadata: FileMetadata)
  - [ ] resolve_imports(tree: Tree, metadata: FileMetadata)
  - [ ] detect_exports(tree: Tree, metadata: FileMetadata)
  - [ ] track_variable_types(tree: Tree, metadata: FileMetadata)
  - [ ] find_function_calls(tree: Tree, metadata: FileMetadata)
  - [ ] find_method_calls(tree: Tree, metadata: FileMetadata)
  - [ ] find_constructor_calls(tree: Tree, metadata: FileMetadata)
  - [ ] build_class_hierarchy(..., metadata: FileMetadata)

### Phase 3: Update graph_builder
- [ ] Import FileMetadata type from @ariadnejs/types
- [ ] Use typed metadata object instead of inline object
- [ ] Ensure all call sites pass proper metadata

### Phase 4: Testing
- [ ] Verify TypeScript compilation passes
- [ ] Update tests to use FileMetadata type
- [ ] Ensure no runtime errors from type changes

## Acceptance Criteria

- [ ] FileMetadata type exists in packages/types
- [ ] All analysis functions use FileMetadata parameter
- [ ] Type safety enforced at compile time
- [ ] No inline metadata objects in graph_builder
- [ ] All tests pass

## Technical Design

```typescript
// packages/types/src/metadata/file_metadata.ts
export interface FileMetadata {
  language: Language;
  file_path: string;
  // Optional fields for optimization:
  source_code?: string;  // Avoid re-reading files
  ast_root?: Tree;       // Pass AST if already parsed
}

// Extended metadata for specific analyses
export interface AnalysisMetadata extends FileMetadata {
  scope_tree?: ScopeTree;  // For functions needing scope info
  module_graph?: ModuleGraph;  // For cross-module analysis
}
```

## Benefits

1. **Type Safety**: Catch metadata field mismatches at compile time
2. **Consistency**: Single source of truth for metadata structure
3. **Documentation**: Self-documenting what data is available
4. **Extensibility**: Easy to add new metadata fields centrally
5. **Refactoring**: Change metadata structure in one place

## Notes

- Consider whether some functions need extended metadata (AnalysisMetadata)
- Some functions might not need all metadata fields
- Keep metadata immutable to prevent side effects
- Consider memory implications of optional fields like source_code