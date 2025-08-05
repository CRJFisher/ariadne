---
id: task-100.20.1
title: Eliminate redundant NavigationService and QueryService
status: To Do
assignee: []
created_date: '2025-08-05 21:38'
labels: []
dependencies: []
parent_task_id: task-100.20
---

## Description

NavigationService and QueryService are now redundant thin wrappers that just delegate to other functions. They add unnecessary complexity without providing value. We should eliminate them and use their underlying functions directly.

### Current State Analysis

**NavigationService (226 lines) - Mostly Delegation:**
- `findReferences()` → just calls `find_all_references()` 
- `goToDefinition()` → just calls `find_definition()`
- `getScopeGraph()` → just returns `state.file_graphs.get(filePath)`
- `getAllScopeGraphs()` → just returns copy of `state.file_graphs`
- `getFunctionsInFile()` → filters graph nodes by symbol_kind
- `getDefinitions()` → just returns `graph.getNodes('definition')`
- `getAllFunctions()` → iterates graphs and filters nodes
- `getExportedFunctions()` → filters nodes by is_exported flag
- `isDefinitionExported()` → checks tracker.exportedDefinitions
- `getImportsWithDefinitions()` → delegates to ImportResolver
- Private helpers: `isPrivateFunction()`, `isTestFunction()`

**QueryService (250+ lines) - Mostly Utilities:**
- `getSourceCode()` → calculates byte positions and extracts substring
- `getSourceWithContext()` → gets source with surrounding lines
- `getImportsWithDefinitions()` → delegates to ImportResolver
- 150+ lines of legacy code marked as "TODO: Remove"
- Broken ProjectSource dependency that's not even used

### Problems with Current Architecture

1. **Unnecessary Indirection**: `Project → NavigationService → find_definition()` when it could be `Project → find_definition()`
2. **Unclear Ownership**: Both services have overlapping concerns
3. **Artificial Grouping**: Methods grouped by service name rather than actual functionality
4. **Maintenance Burden**: Two extra files/classes to maintain with no real value
5. **Confusing for New Developers**: Hard to know which service to use for what

### Proposed New Architecture

Instead of:
```
Project 
  ├→ NavigationService (thin wrapper)
  │   ├→ find_definition()
  │   ├→ find_all_references()
  │   └→ ImportResolver
  └→ QueryService (thin wrapper)
      ├→ ImportResolver
      └→ source extraction utilities
```

We should have:
```
Project 
  ├→ ImportResolver (direct - already done)
  ├→ Symbol resolution (direct functions from symbol_resolver)
  └→ Source utilities (standalone utility functions)
```

Or even simpler - many of these one-liner delegations can just be methods on Project itself.

## Acceptance Criteria

- [ ] NavigationService completely removed
- [ ] QueryService completely removed
- [ ] All NavigationService methods moved to appropriate locations
- [ ] All QueryService methods moved to appropriate locations
- [ ] Project class updated to use services directly
- [ ] No loss of functionality
- [ ] All tests still passing

## Implementation Plan

### Phase 1: Create Replacement Functions

1. **Create source_utils.ts** with extraction functions:
   - `extractSourceCode(cache, range)` - from QueryService.getSourceCode
   - `extractSourceWithContext(cache, range, contextLines)` - from QueryService.getSourceWithContext

2. **Create query_utils.ts** for complex queries:
   - `getAllFunctions(state, options)` - from NavigationService
   - `getFunctionsInFile(graph, filePath)` - from NavigationService
   - `getExportedFunctions(graph)` - from NavigationService
   - `isPrivateFunction(def)` and `isTestFunction(def)` - helper functions

### Phase 2: Update Project Class

3. **Add direct methods to Project class**:
   ```typescript
   // Direct delegation to symbol_resolver
   findReferences(filePath, position) { 
     return find_all_references(filePath, position, this.state.file_graphs);
   }
   
   goToDefinition(filePath, position) {
     return find_definition(filePath, position, this.state.file_graphs);
   }
   
   // Direct access to state
   getScopeGraph(filePath) {
     return this.state.file_graphs.get(filePath);
   }
   
   // Direct delegation to ImportResolver
   getImportsWithDefinitions(filePath) {
     return this.importResolver.getImportsWithDefinitions(this.state, filePath);
   }
   ```

### Phase 3: Update All Consumers

4. **Update CallGraphService** to use utilities directly
5. **Update all Project methods** that use NavigationService/QueryService
6. **Update tests** to use new structure

### Phase 4: Remove Old Services

7. **Delete NavigationService.ts and QueryService.ts**
8. **Remove from Project constructor**
9. **Clean up all imports**

### Benefits After Implementation

- **Simpler Architecture**: 2 fewer abstraction layers
- **Clearer Code**: Direct function calls instead of service indirection
- **Easier Testing**: Test utilities directly without service wrappers
- **Better Performance**: One less function call per operation
- **Reduced Maintenance**: ~500 lines of wrapper code removed
