---
id: task-100.11
title: Refactor project_call_graph.ts to be under 32KB tree-sitter limit
status: In Progress
assignee:
  - '@chuck'
created_date: '2025-08-04 13:54'
updated_date: '2025-08-04 14:18'
labels:
  - refactoring
  - file-size
  - tree-sitter
dependencies:
  - task-100.6
parent_task_id: task-100
---

## Description

The project_call_graph.ts file is currently 60KB, which exceeds the 32KB tree-sitter parsing limit. This causes the file to be skipped during Ariadne's self-analysis, leading to false top-level node identification and missing call relationships. The file should be refactored into smaller modules to ensure all code can be parsed and analyzed.

## Acceptance Criteria

- [ ] project_call_graph.ts is split into multiple files under 32KB each
- [ ] All functionality remains intact with proper imports/exports
- [ ] No files in packages/core/src exceed 32KB
- [ ] Ariadne can successfully parse all split files
- [ ] Validation tests pass with the refactored structure

## Implementation Plan

1. Analyze project_call_graph.ts structure to identify logical split points
2. Create separate modules for:
   - Type tracking classes (FileTypeTracker, LocalTypeTracker, ProjectTypeRegistry)
   - Import/export detection logic
   - Method call resolution logic
   - Call graph building logic
3. Keep the main ProjectCallGraph class as a coordinator
4. Ensure each new file is well under 32KB (target ~20KB max for safety)
5. Update imports in files that use ProjectCallGraph
6. Test that all functionality works correctly after refactoring
7. Verify all new files can be parsed by tree-sitter

## Implementation Notes

Created immutable refactoring plan with 7 sub-tasks:

1. task-100.11.1: Implement immutable type tracking system
2. task-100.11.2: Create immutable import/export detection module  
3. task-100.11.3: Implement immutable call analysis with state passing
4. task-100.11.4: Create immutable ProjectCallGraphData with update functions
5. task-100.11.5: Implement two-phase call graph building
6. task-100.11.6: Add immutability tests and performance benchmarks
7. task-100.11.7: Migrate and update all tests for immutable implementation

The plan focuses on transforming the mutable class-based system into a fully immutable functional approach. This will significantly improve code quality, eliminate bugs from shared mutable state, and make the code much easier to test and reason about.

Key principles:
- All data structures are immutable
- All functions are pure (no side effects)
- State changes flow through return values
- Use structural sharing for efficiency
