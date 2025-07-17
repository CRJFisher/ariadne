---
id: task-17
title: Implement public access to ScopeGraph
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Expose the ScopeGraph class through the public API to enable external access to the scope graph for each file. This is critical for Code Charter's call graph generation capabilities.

## Acceptance Criteria

- [x] ScopeGraph is accessible via Project.get_scope_graph() method
- [x] ScopeGraph is accessible via Project.get_all_scope_graphs() method
- [x] Both methods have proper TypeScript type definitions
- [x] Methods handle non-existent files gracefully
- [x] Unit tests cover both methods

## Proposed API from Enhancement Proposal

```typescript
class Project {
    // New method to get the scope graph for a specific file
    get_scope_graph(file_path: string): ScopeGraph | null;
    
    // Alternative: get all scope graphs
    get_all_scope_graphs(): Map<string, ScopeGraph>;
}
```

## Code Charter Use Cases

- **Call Graph Generation**: Use `graph.getNodes('definition')` to find all functions, then `graph.getRefsForDef()` to trace what each function calls
- **Function Boundary Detection**: Use the enclosing range from definitions to extract exact function source code for summarization
- **Scope Analysis**: Determine which references are within a function's body vs module-level code

## Implementation Plan

1. Analyze current Project class structure and ScopeGraph usage
2. Add get_scope_graph() method to Project class
3. Add get_all_scope_graphs() method to Project class
4. Ensure proper TypeScript type definitions and JSDoc
5. Handle edge cases for non-existent files
6. Write comprehensive unit tests
7. Update documentation

## Implementation Notes

Implemented public access to ScopeGraph through two new methods in the Project class:

- **get_scope_graph(file_path)**: Returns the ScopeGraph for a specific file or null if not found
- **get_all_scope_graphs()**: Returns a copy of all ScopeGraphs in the project as a Map

Both methods are properly typed and handle edge cases gracefully. The get_all_scope_graphs method returns a copy to prevent external modifications to the internal state.

Added comprehensive unit tests to verify:
- Proper graph retrieval for existing files
- Null return for non-existent files
- Complete graph collection retrieval
- Isolation of internal state (returns copies, not references)

Modified files:
- src/index.ts: Added ScopeGraph to exports and implemented the two new methods
- src/index.test.ts: Added test suite for public ScopeGraph access