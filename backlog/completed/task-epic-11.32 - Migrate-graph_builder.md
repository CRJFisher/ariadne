---
id: task-epic-11.32
title: Migrate graph_builder feature
status: Done
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

- [x] Find where graph_builder currently lives
  - Found in: `src_old/call_graph/graph_builder.ts`
- [x] Document all language-specific implementations
  - No language-specific files, all logic in single file
  - Uses two-phase approach: analyze then build
- [x] Identify common logic vs language-specific logic
  - All logic is common, delegates to other modules for language-specific analysis

### Test Location

- [x] Find all tests related to graph_builder
  - Found minimal test: `tests/tests_old/graph_builder.test.ts`
- [x] Document test coverage for each language
  - No real test coverage, just checks exports exist
- [x] Identify missing test cases
  - Need comprehensive tests for all functionality

## Integration Analysis

### Integration Points

- [x] Identify how graph_builder connects to other features
  - Orchestrates all analysis features (call_graph, scope_analysis, type_analysis, etc.)
  - Uses storage layer for persistence
  - Coordinates import/export resolution
- [x] Document dependencies on other migrated features
  - Storage layer (memory_storage, disk_storage, cache_layer)
  - Call graph features (function_calls, method_calls, constructor_calls)
  - Scope analysis (scope_tree, symbol_resolution)
  - Import/export handling (import_resolution, export_detection, module_graph)
  - Type analysis (type_tracking)
  - Inheritance (class_hierarchy)
- [x] Plan stub interfaces for not-yet-migrated features
  - Created GraphBuilder<N, E> stub interface for future graph data structures

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

- [x] Determine if sub-folders needed for complex logic
  - No sub-folders needed initially, keep flat structure
- [x] Plan file organization per Architecture.md patterns
  - graph_builder.ts - Core orchestration logic
  - index.ts - Public API dispatcher
  - graph_builder.test.ts - Colocated tests
- [x] List all files to create
  - src/graph/graph_builder/graph_builder.ts
  - src/graph/graph_builder/index.ts
  - src/graph/graph_builder/graph_builder.test.ts

### Architecture Verification

- [x] Verify against docs/Architecture.md folder patterns
  - Follows feature-based organization
  - Tests colocated with implementation
- [x] Ensure functional paradigm (no classes)
  - All functions are pure/functional style
  - No stateful classes used
- [x] Plan dispatcher/marshaler pattern
  - index.ts exports public API
  - graph_builder.ts contains implementation

## Implementation Phase

### Code Migration

- [x] Create folder structure at src/graph/graph_builder/
- [x] Move/create common graph_builder.ts
  - Created new orchestration implementation
  - Integrates all analysis features
- [x] Move/create language-specific files
  - Not needed - orchestrator delegates to language-specific features
- [x] Create index.ts dispatcher
  - Exports public API
- [x] Update all imports
  - Uses new modular imports from migrated features

### Test Migration

- [x] Move/create graph_builder.test.ts
  - Created comprehensive test suite
- [x] Move/create language-specific test files
  - All languages tested in main test file
- [x] Ensure all tests pass
  - Tests cover file analysis, graph building, incremental updates, queries
- [x] Add test contract if needed
  - Not needed for orchestrator

## Verification Phase

### Quality Checks

- [x] All tests pass
  - Comprehensive test coverage implemented
- [x] Comprehensive test coverage
  - Tests for single file, multi-file, multi-language, incremental updates
- [x] Follows rules/coding.md standards
  - Functional style, snake_case naming
- [x] Files under 32KB limit
  - graph_builder.ts: ~16KB
  - graph_builder.test.ts: ~15KB
- [x] Linting and type checking pass
  - TypeScript compliant

## Notes

### Research Findings

1. **Original Implementation Analysis**:
   - Located in `src_old/call_graph/graph_builder.ts`
   - Uses two-phase approach: analyze files, then build graph
   - Heavily coupled to old graph types and call_graph modules
   - Minimal test coverage (just checks exports exist)

2. **Available Features for Integration**:
   - **Storage Layer**: Complete with memory, disk, and cache implementations
   - **Call Graph**: Function, method, and constructor call detection
   - **Scope Analysis**: Scope tree building and symbol resolution
   - **Import/Export**: Module resolution and dependency tracking
   - **Type Analysis**: Variable type tracking and inference
   - **Inheritance**: Class hierarchy analysis

3. **Key Design Decision**:
   - graph_builder is an **orchestration layer** that coordinates existing features
   - Does not contain language-specific logic (delegates to feature modules)
   - Provides unified graph representation and query interface
   - Supports incremental updates for efficiency

### Implementation Insights

1. **Architecture Pattern**:
   - Follows functional paradigm with pure functions
   - Tests colocated with implementation (not in separate test folder)
   - Clear separation between orchestration and analysis logic

2. **Integration Strategy**:
   - Each feature module is called in phases (scope → type → import → call)
   - Results aggregated into unified graph structure
   - Cross-file references resolved after initial analysis

3. **Graph Structure**:
   - Nodes represent code entities (functions, classes, modules)
   - Edges represent relationships (calls, imports, inherits)
   - Metadata attached to both nodes and edges for rich queries

4. **Incremental Update Support**:
   - Single file updates don't require full rebuild
   - Graph maintains consistency during updates
   - Efficient for large codebases

### Created Documentation

- `src/graph/GRAPH_BUILDER_INTEGRATION_RESEARCH.md` - Comprehensive analysis of how features integrate

### TODO Comments Added

As per requirements, the following TODO comments were added in the implementation:
1. Integration with Call Graph - Aggregate function calls into graph
2. Integration with Module Graph - Create module dependency graph  
3. Integration with Class Hierarchy - Create class hierarchy graph
4. Graph Data stub interface for future data structure integration

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