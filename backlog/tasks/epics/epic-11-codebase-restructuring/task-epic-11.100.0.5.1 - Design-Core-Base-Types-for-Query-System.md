---
id: task-epic-11.100.0.5.1
title: Design Core Base Types for Query System
status: Complete
assignee: []
created_date: '2025-09-11 17:51'
labels: []
dependencies: []
parent_task_id: task-epic-11.100.0.5
---

## Description

Define foundational base interfaces and patterns that all query-based modules will use. This is the most critical task as all other type refinements depend on these base types.

## Acceptance Criteria

- [ ] Base AST node interface defined with common fields
- [ ] Standard query result wrapper type created
- [ ] Unified resolution pattern established
- [ ] Common metadata types defined
- [ ] Location handling standardized
- [ ] Error types unified
- [ ] Type guards for all base types
- [ ] Full TypeScript strict mode compliance

## Scope

### Core Base Interfaces

```typescript
// 1. Base for all AST-derived data
interface ASTNode {
  readonly location: Location;
  readonly language: Language;
}

// 2. Standard query result wrapper
interface QueryResult<T> {
  readonly data: T;
  readonly captures: QueryCapture[];
  readonly metadata: QueryMetadata;
}

// 3. Unified resolution pattern
interface Resolution<T> {
  readonly resolved: T | undefined;
  readonly confidence: "high" | "medium" | "low";
  readonly reason?: string;
}

// 4. Standard metadata
interface QueryMetadata {
  readonly queryName: string;
  readonly executionTime: number;
  readonly captureCount: number;
  readonly language: Language;
}
```

### Benefits

- **Reduces duplication**: No more repeated location fields
- **Improves consistency**: All modules return same shape
- **Enables composition**: Base types can be extended
- **Better type safety**: Discriminated unions over optional fields

## Affected Modules

This task affects ALL 19 modules as they will all use these base types:
- scope_tree, symbol_resolution, usage_finder, definition_finder
- import_resolution, export_detection, namespace_resolution, module_graph
- function_calls, method_calls, constructor_calls, call_chain_analysis
- class_detection, class_hierarchy, method_override, interface_implementation
- type_tracking, return_type_inference, parameter_type_inference, type_propagation, generic_resolution
- member_access

## Dependencies

- Blocks all other type refinement tasks (11.100.0.5.2 through 11.100.0.5.8)
- Must align with new tree-sitter query architecture

## Implementation Notes

### Completed: 2025-09-11

Successfully created base-query-types.ts with:
- ASTNode and SemanticNode base interfaces
- QueryResult<T> wrapper with captures and metadata
- Resolution<T> pattern for unified resolution results
- QueryError types and error handling
- PagedResult and GroupedResult collection types
- Comprehensive type guards and utility functions
- Helper functions for creating resolutions at different confidence levels

1. Start by reviewing existing common types in `packages/types/src/common.ts`
2. Design interfaces that can be extended by specific modules
3. Use discriminated unions instead of optional fields where possible
4. Ensure all types are immutable (readonly)
5. Create comprehensive type guards for runtime validation
