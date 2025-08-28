---
id: task-epic-11.32.7  
title: Add typed metadata to graph types
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [types, graph-builder, epic-11]
dependencies: [task-epic-11.32, task-epic-11.33]
parent_task_id: task-epic-11.32
---

## Description

Replace the untyped `metadata: Record<string, any>` fields in GraphNode, GraphEdge, and ProjectGraph with properly typed metadata interfaces to improve type safety and documentation.

## Context

Current graph types use untyped metadata:
```typescript
export interface GraphNode {
  // ...
  metadata: Record<string, any>;  // <-- No type checking
}

export interface GraphEdge {
  // ...
  metadata: Record<string, any>;  // <-- No type checking
}

export interface ProjectGraph {
  // ...
  metadata: Record<string, any>;  // <-- No type checking
}
```

This leads to:
1. No compile-time checking of metadata fields
2. No IntelliSense/autocomplete support
3. Unclear what metadata is available
4. Easy to introduce typos or inconsistencies
5. Hard to refactor metadata structure

## Current Metadata Usage

From graph_builder.ts, we can see actual metadata being used:

**GraphNode metadata:**
```typescript
metadata: {
  scope_id: scope.id,
  parent_scope?: scope.parent_id,
  language: file.language,
}
```

**GraphEdge metadata:**
```typescript
metadata: {
  // For calls:
  line: call.line,
  column: call.column,
  is_async: call.is_async,
  // For imports:
  symbols: imp.imported_names,
  is_default: imp.is_default,
  // For exports:
  original_name: exp.original_name,
}
```

**ProjectGraph metadata:**
```typescript
metadata: {
  file_count: files.length,
  node_count: all_nodes.size,
  edge_count: all_edges.size,
  build_time: Date.now(),
  last_update?: Date.now(),
}
```

## Tasks

### Phase 1: Design Metadata Types
- [ ] Create NodeMetadata interface with common fields
- [ ] Create type-specific metadata interfaces (FunctionNodeMetadata, ClassNodeMetadata, etc.)
- [ ] Create EdgeMetadata interface with common fields
- [ ] Create edge-type-specific metadata (CallEdgeMetadata, ImportEdgeMetadata, etc.)
- [ ] Create ProjectMetadata interface

### Phase 2: Update Type Definitions
- [ ] Create metadata types in packages/types
- [ ] Update GraphNode to use typed metadata
- [ ] Update GraphEdge to use typed metadata
- [ ] Update ProjectGraph to use typed metadata

### Phase 3: Support Type Discrimination
- [ ] Use discriminated unions based on node/edge type
- [ ] Ensure TypeScript can narrow types properly
- [ ] Add type guards if necessary

### Phase 4: Update graph_builder
- [ ] Update all metadata creation to use typed interfaces
- [ ] Fix any type errors from stricter typing
- [ ] Ensure all metadata fields are properly typed

### Phase 5: Testing
- [ ] Verify TypeScript compilation with strict types
- [ ] Test that metadata is correctly typed at runtime
- [ ] Update tests to use typed metadata

## Acceptance Criteria

- [ ] All metadata fields are properly typed
- [ ] No `any` types in metadata
- [ ] IntelliSense works for metadata fields
- [ ] Type discrimination works based on node/edge type
- [ ] All existing functionality preserved
- [ ] Tests pass with typed metadata

## Technical Design

```typescript
// Node metadata types
interface BaseNodeMetadata {
  scope_id?: string;
  parent_scope?: string;
}

interface FunctionNodeMetadata extends BaseNodeMetadata {
  is_async?: boolean;
  is_generator?: boolean;
  parameters_count?: number;
}

interface ClassNodeMetadata extends BaseNodeMetadata {
  is_abstract?: boolean;
  extends?: string;
  implements?: string[];
}

interface ModuleNodeMetadata {
  language: Language;
  is_entry_point?: boolean;
}

// Edge metadata types
interface BaseEdgeMetadata {
  source_location?: Point;
}

interface CallEdgeMetadata extends BaseEdgeMetadata {
  line: number;
  column?: number;
  is_async?: boolean;
  arguments_count?: number;
}

interface ImportEdgeMetadata extends BaseEdgeMetadata {
  symbols?: string[];
  is_default?: boolean;
  is_namespace?: boolean;
}

interface ExportEdgeMetadata extends BaseEdgeMetadata {
  is_default?: boolean;
  original_name?: string;
  is_reexport?: boolean;
}

// Graph metadata
interface ProjectMetadata {
  file_count: number;
  node_count: number;
  edge_count: number;
  build_time: number;
  last_update?: number;
  version?: string;
}

// Updated types with discriminated unions
interface GraphNode {
  id: string;
  type: "function" | "class" | "module" | "variable" | "method";
  name: string;
  file_path: string;
  metadata: 
    | FunctionNodeMetadata 
    | ClassNodeMetadata 
    | ModuleNodeMetadata;
}

interface GraphEdge {
  id: string;
  type: "calls" | "imports" | "exports" | "inherits";
  source: string;
  target: string;
  metadata:
    | CallEdgeMetadata
    | ImportEdgeMetadata
    | ExportEdgeMetadata;
}
```

## Benefits

1. **Type Safety**: Catch metadata field errors at compile time
2. **Documentation**: Self-documenting metadata structure
3. **IntelliSense**: IDE support for metadata fields
4. **Refactoring**: Safely rename/change metadata fields
5. **Consistency**: Enforce consistent metadata structure

## Notes

- Consider using generics for better type discrimination
- May need different metadata for different languages
- Keep optional fields truly optional (use ? not | undefined)
- Consider metadata versioning for future compatibility