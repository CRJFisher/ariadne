---
id: task-epic-11.32.1
title: Implement cross-file reference resolution in graph_builder
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [enhancement, graph, epic-11]
dependencies: [task-epic-11.32]
parent_task_id: task-epic-11.32
---

## Description

Implement cross-file reference resolution in the graph_builder to properly link calls, imports, and type references across module boundaries.

## Context

The current graph_builder implementation analyzes files individually and creates nodes/edges within each file. However, it doesn't yet resolve references across files - for example, when a function in one file calls a function exported from another file.

## Tasks

- [ ] Implement cross-file call resolution
  - Match function calls to exported functions in other modules
  - Use import resolution to find target definitions
- [ ] Implement cross-file type resolution
  - Track type exports and imports
  - Link type references to definitions in other files
- [ ] Implement cross-file class inheritance
  - Resolve base classes imported from other modules
  - Build complete inheritance hierarchy across files
- [ ] Add cross-file edge types
  - Add 'cross-file-call' edge type
  - Add 'cross-file-inherits' edge type
- [ ] Update tests for cross-file resolution

## Acceptance Criteria

- [ ] Function calls resolve to definitions in imported modules
- [ ] Type references resolve across file boundaries
- [ ] Class inheritance works across files
- [ ] Graph accurately represents cross-file relationships
- [ ] Tests verify cross-file resolution works correctly

## Technical Notes

The graph_builder already has the foundation for this:
1. Import/export information is collected for each file
2. Module graph tracks dependencies
3. Need to add a resolution phase after initial analysis

Can leverage existing import_resolution and export_detection modules for matching.