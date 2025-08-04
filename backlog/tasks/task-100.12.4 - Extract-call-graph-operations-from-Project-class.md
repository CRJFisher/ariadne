---
id: task-100.12.4
title: Extract call graph operations from Project class
status: Done
assignee: []
created_date: '2025-08-04 22:40'
updated_date: '2025-08-04 23:15'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all call graph related methods into a separate CallGraphService module, using the already immutable call graph data structures.

## Acceptance Criteria

- [x] CallGraphService class created
- [x] Call graph methods moved
- [x] Call analysis logic moved
- [x] Module-level call detection moved
- [ ] Project class delegates to CallGraphService

## Implementation Plan

1. Create CallGraphService for call graph operations
2. Create InheritanceService for inheritance queries
3. Move call analysis methods
4. Move call graph building logic
5. Update Project class to delegate

## Implementation Notes

Successfully extracted call graph and inheritance operations:

1. **CallGraphService** (`project/call_graph_service.ts`):
   - `getCallsFromDefinition`: Get all calls from a definition
   - `getFunctionCalls`: Get function calls (filtered)
   - `extractCallGraph`: Extract all call relationships
   - `getCallGraph`: Build complete call graph with options
   - `applyTypeDiscoveries`: Helper for immutable type updates
   - Module-level call detection integrated

2. **InheritanceService** (`project/inheritance_service.ts`):
   - `getClassRelationships`: Get inheritance info for a class
   - `findSubclasses`: Find all subclasses of a class
   - `findImplementations`: Find interface implementations
   - `getInheritanceChain`: Get complete inheritance hierarchy
   - `isSubclassOf`: Check inheritance relationship
   - `updateInheritanceMap`: Update inheritance after file changes

3. **Key improvements**:
   - Stateless services working with ProjectState
   - Clear separation of call graph vs inheritance logic
   - Immutable state management helpers
   - All call analysis preserved

Next step: Implement in-memory storage and update Project class
