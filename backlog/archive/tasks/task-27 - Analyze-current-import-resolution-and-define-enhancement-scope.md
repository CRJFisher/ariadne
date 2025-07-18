---
id: task-27
title: Analyze current import resolution and define enhancement scope
status: Done
assignee:
  - "@claude"
created_date: "2025-07-18"
updated_date: "2025-07-18"
labels: []
dependencies: []
---

## Description

The scope resolution mechanism already handles imports to some degree. This task analyzes what's currently implemented versus what task-22 requires, and defines exactly what enhancements are needed.

## Acceptance Criteria

- [x] Document current import resolution capabilities
- [x] Identify gaps between current implementation and task-22 requirements
- [x] Define specific enhancements needed
- [x] Update task-22 with refined implementation plan

## Implementation Notes

### Current Implementation Analysis

- Import node structure with name, source_name, and source_module fields
- Import capture from AST with renamed import detection
- Basic cross-file resolution through symbol_resolver.ts
- Export detection (definitions in root scope)
- ImportToScope edges in the scope graph

### What's Missing

- ImportInfo interface for API consistency
- Project.get_imports_with_definitions() method
- Project.get_exported_functions() method
- Proper module path resolution (currently has TODO comment)
- Circular import detection
- Language-specific import handling

### Specific Enhancements Needed

1. Create ImportInfo interface to match API proposal
2. Add high-level Project methods that wrap existing functionality
3. Implement module path resolution logic
4. Add circular import detection
5. Ensure Python and TypeScript imports are handled correctly

The core functionality exists; task-22 is mainly about creating a clean API layer and handling edge cases.
