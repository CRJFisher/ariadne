---
id: task-epic-11.33
title: Create graph data structures and move types to packages/types
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, data-layer, epic-11, types]
dependencies: [task-epic-11.32]
parent_task_id: epic-11
---

## Description

Create proper graph data structures to replace the stub interfaces in graph_builder, and move all public graph types to `packages/types` following the architecture pattern where shared types belong in the types package.

## Research Phase

### Current State (from task-epic-11.32)

- [ ] Review graph_builder implementation in `src/graph/graph_builder/`
- [ ] Identify types currently defined in graph_builder.ts:
  - GraphNode, GraphEdge, ProjectGraph interfaces
  - FileAnalysisResult, GraphBuilderConfig interfaces
- [ ] Identify the stub Graph<N, E> interface that needs replacement
- [ ] Analyze what graph operations are needed

### Type Organization

- [ ] Determine which types are public API (go to packages/types)
- [ ] Determine which are internal implementation (stay in packages/core)
- [ ] Plan the structure for packages/types/src/graph/

## Integration Analysis

### Integration with graph_builder

- [ ] graph_builder currently uses Map<string, GraphNode> and Map<string, GraphEdge>
- [ ] Need proper graph data structure with:
  - Efficient node/edge lookup
  - Graph traversal methods
  - Serialization support
  - Memory efficiency for large graphs

### Required Features

1. **Graph Operations**:
   - Add/remove nodes and edges
   - Find neighbors, predecessors, successors
   - Path finding (shortest path, all paths)
   - Cycle detection
   - Connected components

2. **Graph Types**:
   - Directed graph (for call graphs, dependencies)
   - Support for multiple edge types
   - Node and edge metadata/properties

3. **Performance Requirements**:
   - Handle graphs with 10,000+ nodes
   - Efficient traversal operations
   - Low memory footprint

## Planning Phase

### Type Package Structure (packages/types)

- [ ] Create `packages/types/src/graph/` for public graph types:
  - `graph.types.ts` - Core graph interfaces (GraphNode, GraphEdge, etc.)
  - `index.ts` - Public exports

### Core Package Structure (packages/core)

- [ ] Determine if internal graph utilities needed in `src/graph/graph_data/`:
  - Only if implementation details that shouldn't be exposed
  - Graph algorithms that are internal to core
  - Private helper functions

### Architecture Decisions

- [ ] Public types go to packages/types (consumed by other packages)
- [ ] Implementation details stay in packages/core
- [ ] Follow functional paradigm for graph operations

## Implementation Phase

### Step 1: Move Types to packages/types

- [ ] Extract graph types from `packages/core/src/graph/graph_builder/graph_builder.ts`:
  - GraphNode, GraphEdge, ProjectGraph
  - FileAnalysisResult, GraphBuilderConfig
- [ ] Create `packages/types/src/graph/graph.types.ts` with these types
- [ ] Export from `packages/types/src/index.ts`
- [ ] Update graph_builder imports to use @ariadnejs/types

### Step 2: Create Graph Data Structure (if needed)

- [ ] Evaluate if a proper graph class is needed or if Maps are sufficient
- [ ] If needed, create implementation in `packages/core/src/graph/graph_data/`:
  - `directed_graph.ts` - Directed graph implementation
  - `graph_algorithms.ts` - Graph algorithms (private to core)
  - `index.ts` - Internal exports
- [ ] Replace stub interfaces in graph_builder

### Step 3: Update graph_builder

- [ ] Update to use types from @ariadnejs/types
- [ ] If graph data structure created, integrate it
- [ ] Update tests to reflect new type locations

## Verification Phase

### Quality Checks

- [ ] Types properly separated (public in types, private in core)
- [ ] No circular dependencies between packages
- [ ] graph_builder still works with moved types
- [ ] All tests pass
- [ ] TypeScript compilation succeeds
- [ ] Follows Architecture.md patterns

## Notes

### Key Architecture Principle

**Types Placement Strategy:**

- **packages/types**: Public interfaces and types used across packages
  - GraphNode, GraphEdge, ProjectGraph (consumed by MCP, CLI, etc.)
  - FileAnalysisResult, GraphBuilderConfig
  - Any type that forms part of the public API
  
- **packages/core**: Private implementation details
  - Internal helper types (BuildContext, GraphBuilder stub)
  - Implementation-specific interfaces
  - Graph algorithms that aren't exposed

### Context from task-epic-11.32

The graph_builder implementation currently defines all its types inline. These should be:

1. Extracted to packages/types for public API types
2. Graph data structure implementation (if needed) stays private in core
3. The stub `Graph<N, E>` interface should be replaced with either:
   - A proper implementation if complex graph operations are needed
   - Keep using Maps if simple structure is sufficient
