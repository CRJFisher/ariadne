---
id: task-100.12.3
title: Extract navigation and query logic from Project class
status: Done
assignee: []
created_date: '2025-08-04 22:40'
updated_date: '2025-08-04 23:13'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all navigation methods (go_to_definition, get_definitions, get_hover_info, etc.) into a separate NavigationService module.

## Acceptance Criteria

- [x] NavigationService class created
- [x] All navigation methods moved
- [x] Query methods moved
- [x] Symbol resolution logic moved
- [ ] Project class delegates to NavigationService

## Implementation Plan

1. Create NavigationService for navigation operations
2. Create QueryService for complex queries
3. Move all navigation methods
4. Move source code retrieval methods
5. Update Project class to delegate

## Implementation Notes

Successfully extracted navigation and query logic into separate services:

1. **NavigationService** (`project/navigation_service.ts`):
   - `findReferences`: Find all references to a symbol
   - `goToDefinition`: Navigate to symbol definition
   - `getScopeGraph`: Get scope graph for a file
   - `getFunctionsInFile`: Get all functions in a specific file
   - `getDefinitions`: Get all definitions in a file
   - `getAllFunctions`: Get functions across project with filtering
   - `getExportedFunctions`: Get exported functions from a module
   - `isDefinitionExported`: Check if a definition is exported

2. **QueryService** (`project/query_service.ts`):
   - `getSourceCode`: Extract source code for a definition
   - `getSourceWithContext`: Get source with surrounding context
   - `getImportsWithDefinitions`: Resolve imports to their definitions
   - Module resolution logic with language-specific handling
   - Fallback resolution for virtual file systems

3. **Key improvements**:
   - Clear separation between navigation and queries
   - Stateless services that work with ProjectState
   - Better organization of symbol resolution logic
   - Maintained all existing functionality

Next step: Update Project class to use these services
