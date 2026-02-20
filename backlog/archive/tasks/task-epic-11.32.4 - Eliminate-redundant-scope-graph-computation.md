---
id: task-epic-11.32.4
title: Eliminate redundant scope graph computation
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [performance, graph-builder, epic-11]
dependencies: [task-epic-11.32, task-epic-11.32.3]
parent_task_id: task-epic-11.32
---

## Description

Eliminate redundant scope graph/tree computation by passing the already-computed scope tree from graph_builder to downstream analysis functions, rather than having them recompute or fetch it independently.

## Context

The graph_builder currently:
1. Builds the scope tree: `const scopes = build_scope_tree(file.tree!, metadata);`
2. Then calls functions like detect_exports that have a config requiring `get_scope_graph`

Looking at export_detection/export_detection.ts:
```typescript
export interface ExportDetectionConfig {
  get_scope_graph: (file_path: string) => ScopeGraph | undefined;
  // ...
}
```

This means detect_exports might be fetching/computing the scope graph again, even though graph_builder just built it. This is inefficient and could lead to inconsistencies.

## Current Problem

The analysis functions have configs that fetch scope graphs independently:
- detect_exports uses `config.get_scope_graph(file_path)`
- Other functions might be doing similar recomputation
- The graph_builder already has the scope tree but doesn't pass it down

## Tasks

### Phase 1: Analysis
- [ ] Identify all functions that use get_scope_graph or similar patterns
- [ ] Determine which functions actually need scope information
- [ ] Check if ScopeTree and ScopeGraph are the same type or need conversion

### Phase 2: Refactor Interfaces
- [ ] Update ExportDetectionConfig to accept scope_tree directly
- [ ] Update other configs that need scope information
- [ ] Consider adding scope_tree to FileMetadata or AnalysisMetadata

### Phase 3: Update graph_builder
- [ ] Pass computed scope tree to functions that need it
- [ ] Remove redundant scope graph fetching
- [ ] Ensure single computation per file

### Phase 4: Update Implementations
- [ ] Update detect_exports to use passed scope tree
- [ ] Update other functions to use passed scope tree
- [ ] Remove get_scope_graph callbacks where possible

### Phase 5: Testing
- [ ] Verify scope tree is only computed once per file
- [ ] Ensure all functions receive correct scope information
- [ ] Performance testing to verify improvement

## Acceptance Criteria

- [ ] Scope tree is computed exactly once per file
- [ ] All analysis functions receive pre-computed scope tree
- [ ] No redundant scope graph fetching/computation
- [ ] Performance improvement measurable
- [ ] All tests pass

## Technical Design

### Option 1: Pass scope_tree in metadata
```typescript
interface AnalysisMetadata extends FileMetadata {
  scope_tree: ScopeTree;  // Always available after initial computation
}
```

### Option 2: Pass scope_tree as separate parameter
```typescript
detect_exports(tree: Tree, metadata: FileMetadata, scope_tree: ScopeTree): ExportInfo[]
```

### Option 3: Create analysis context
```typescript
interface AnalysisContext {
  metadata: FileMetadata;
  scope_tree: ScopeTree;
  tree: Tree;
}

detect_exports(context: AnalysisContext): ExportInfo[]
```

## Benefits

1. **Performance**: Eliminate redundant tree traversal and scope building
2. **Consistency**: Single source of truth for scope information
3. **Memory**: Avoid duplicate scope tree storage
4. **Simplicity**: Remove callback complexity from configs

## Implementation Notes

- Need to verify if ScopeTree from scope_tree.ts matches ScopeGraph expected by other modules
- Consider caching strategy if scope tree needs transformation
- May need to update type definitions to ensure compatibility
- Consider backward compatibility during migration