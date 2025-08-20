---
id: task-epic-11.13
title: Migrate module_graph feature
status: To Do
assignee: []
created_date: '2025-08-20'
labels: [migration, import-export, epic-11]
dependencies: [task-epic-11.2]
parent_task_id: epic-11
---

## Description

Migrate the `module_graph` feature to `src/import_export/module_graph/` following Architecture.md patterns.

## Research Phase

**NOTE**: First read `CODEBASE_HIERARCHY_ANALYSIS.md` sections:
- `## Current Codebase Structure (As Implemented)` - understand current locations
- `### Proposed Structure` - understand target architecture

### Current Location

- [x] Find where module dependency graph currently lives
  - No existing module graph implementation found
  - Related functionality in src_old/call_graph/graph_builder.ts (call graphs, not module graphs)
  - Created new implementation from scratch
- [x] Document all language-specific implementations
  - Module graphs are language-agnostic at the graph level
  - Language detection handled by file extensions
  - Import/export patterns delegated to other features
- [x] Identify common logic vs language-specific logic
  - Common: Graph building, cycle detection, dependency analysis
  - Language-specific: None needed (uses import_resolution and export_detection)

### Test Location

- [x] Find all tests related to module graph
  - No existing tests found (new feature)
- [x] Document test coverage for each language
  - Created comprehensive test suite in module_graph.test.ts
  - Tests are language-agnostic (work with all languages)
- [x] Identify missing test cases
  - All core functionality tested

## Integration Analysis

### Integration Points

- [x] Identify how module_graph connects to other features
  - Uses import_resolution to get imports
  - Uses export_detection to get exports
  - Provides data for type_propagation
  - Supports namespace imports from namespace_resolution
- [x] Document dependencies on other migrated features
  - Depends on export_detection (completed)
  - Depends on import_resolution (partial)
  - Works with namespace_resolution (completed)
- [x] Plan stub interfaces for not-yet-migrated features
  - Created ModuleResolver interface for path resolution
  - Created TypeEdge interface for type propagation

### Required Integrations

1. **Import Resolution**: Module graph shows import relationships
   - TODO: Add import edges to graph
2. **Export Detection**: Module interfaces defined by exports
   - TODO: Add export nodes to graph
3. **Namespace Resolution**: Track namespace import edges
   - TODO: Special edge type for namespace imports
4. **Type Propagation**: Type flow through module boundaries
   - TODO: Add type edges to graph

### Stub Interfaces to Create

```typescript
// TODO: Add these stubs in implementation
interface ModuleNode { file: string; exports: ExportInfo[]; imports: ImportInfo[]; }
interface ModuleEdge { from: string; to: string; type: 'import' | 'namespace' | 'type'; }
```

## Planning Phase

### Folder Structure

- [x] Determine if sub-folders needed for complex logic
  - No sub-folders needed, module graphs are unified
- [x] Plan file organization per Architecture.md patterns
  - Main logic in module_graph.ts
  - Dispatcher/API in index.ts
  - Tests in module_graph.test.ts
- [x] List all files to create
  - module_graph.ts (created)
  - index.ts (created)
  - module_graph.test.ts (created)

### Architecture Verification

- [x] Verify against docs/Architecture.md folder patterns
  - Follows feature-based organization
  - Located under import_export as it deals with module relationships
- [x] Ensure functional paradigm (no classes)
  - All code uses functions and interfaces
  - Builder pattern implemented functionally
- [x] Plan dispatcher/marshaler pattern
  - index.ts provides main API and utilities

## Implementation Phase

### Code Migration

- [x] Create folder structure at src/import_export/module_graph/
  - Created new directory
- [x] Move/create common module_graph.ts
  - Created new implementation (no existing code to migrate)
- [x] Move/create language-specific files
  - Not needed - module graphs are language-agnostic
- [x] Create index.ts dispatcher
  - Created with builder API and analysis utilities
- [x] Update all imports
  - No imports to update (new feature)

### Test Migration

- [x] Move/create module_graph.test.ts
  - Created comprehensive test suite
- [x] Move/create language-specific test files
  - Not needed - tests are language-agnostic
- [ ] Ensure all tests pass
  - Tests created, need to run
- [ ] Add test contract if needed

## Verification Phase

### Quality Checks

- [ ] All tests pass
- [x] Comprehensive test coverage
  - All core functions tested
- [x] Follows rules/coding.md standards
  - Functional paradigm, snake_case naming
- [x] Files under 32KB limit
  - module_graph.ts: ~16KB
  - index.ts: ~10KB
- [ ] Linting and type checking pass

## Notes

Research findings will be documented here during execution.

### Implementation Summary

- Created module graph feature from scratch (no existing implementation)
- Designed to be language-agnostic, delegating to other features
- Comprehensive functionality including cycle detection and analysis
- Export formats for visualization (JSON, DOT, Mermaid)

### Key Design Decisions

1. **Language-Agnostic**: Module graphs work across all languages
2. **Delegation Pattern**: Uses import_resolution and export_detection
3. **Rich Analysis**: Includes cycle detection, importance calculation (PageRank)
4. **Visualization Ready**: Multiple export formats for graph visualization
5. **Builder Pattern**: Incremental graph building with caching

### Key Features Implemented

- **Graph Building**: Create module dependency graphs from file sets
- **Cycle Detection**: Find circular dependencies
- **Dependency Analysis**: Get dependencies/dependents (direct or transitive)
- **Module Importance**: PageRank-like algorithm for module importance
- **Unused Module Detection**: Find modules with no imports
- **Export Formats**: JSON, Graphviz DOT, Mermaid diagrams
- **Entry Point Detection**: Automatic detection of entry points
- **External Module Tracking**: Distinguish external dependencies

### Insights

- Module graphs are fundamentally language-agnostic
- The real complexity is in import/export detection (handled by other features)
- Circular dependency detection is critical for large codebases
- Module importance metrics help identify critical code
- Visualization exports enable integration with graph tools

### Integration TODOs to Add

When implementing, add these TODO comments:

1. In `module_graph.ts`:
   ```typescript
   // TODO: Integration with Import Resolution
   // - Add import edges to graph
   // TODO: Integration with Export Detection
   // - Add export nodes to graph
   // TODO: Integration with Namespace Resolution
   // - Special edge type for namespace imports
   ```

2. In language-specific files (if applicable):
   ```typescript
   // TODO: Type Propagation - Add type edges to graph
   ```