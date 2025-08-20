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

- [ ] Find where module dependency graph currently lives
- [ ] Document all language-specific implementations
- [ ] Identify common logic vs language-specific logic

### Test Location

- [ ] Find all tests related to module graph
- [ ] Document test coverage for each language
- [ ] Identify missing test cases

## Integration Analysis

### Integration Points

- [ ] Identify how module_graph connects to other features
- [ ] Document dependencies on other migrated features
- [ ] Plan stub interfaces for not-yet-migrated features

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

- [ ] Determine if sub-folders needed for complex logic
- [ ] Plan file organization per Architecture.md patterns
- [ ] List all files to create

### Architecture Verification

- [ ] Verify against docs/Architecture.md folder patterns
- [ ] Ensure functional paradigm (no classes)
- [ ] Plan dispatcher/marshaler pattern

## Implementation Phase

### Code Migration

- [ ] Create folder structure at src/import_export/module_graph/
- [ ] Move/create common module_graph.ts
- [ ] Move/create language-specific files
- [ ] Create index.ts dispatcher
- [ ] Update all imports

### Test Migration

- [ ] Move/create module_graph.test.ts
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