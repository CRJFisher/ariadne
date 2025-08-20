---
id: task-epic-11.32
title: Migrate graph_builder feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, data-layer, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `graph_builder` feature to `src/graph/graph_builder/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [ ] Find where graph_builder currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to graph_builder
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how graph_builder connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

### Required Integrations

1. **Call Graph**: Build call graph
   - TODO: Aggregate function calls into graph
2. **Module Graph**: Build module graph
   - TODO: Create module dependency graph
3. **Class Hierarchy**: Build inheritance graph
   - TODO: Create class hierarchy graph
4. **Graph Data**: Use graph data structures
   - TODO: Store in graph format

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface GraphBuilder<N, E> { add_node(node: N): void; add_edge(edge: E): void; build(): Graph<N, E>; }
```

## Planning Phase

### Folder Structure

- [ ] Determine if sub-folders needed for complex logic
- [ ] Plan file organization per Architecture.md patterns
- [ ] List all files to create

### Architecture Verification

- [ ] Verify against docs/Architecture.md folder patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan dispatcher/marshaler pattern

## Implementation Phase

### Code Migration

- [ ] Create folder structure at src/graph/graph_builder/
- [ ] Move/create common graph_builder.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create graph_builder.test.ts
- [ ] Move/create language-specific test files
- [ ] Ensure all tests pass
- [ ] Add test contract if needed

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [ ] Comprehensive test coverage
- [ ] Follows rules/coding.md standards
- [ ] Files under 32KB limit
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `graph_builder.ts`:
   ```typescript
   // TODO: Integration with Call Graph
   // - Aggregate function calls into graph
   // TODO: Integration with Module Graph
   // - Create module dependency graph
   // TODO: Integration with Class Hierarchy
   // - Create class hierarchy graph
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Graph Data - Store in graph format
   ```