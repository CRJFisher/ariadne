---
id: task-17
title: Implement public access to ScopeGraph
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Expose the ScopeGraph class through the public API to enable external access to the scope graph for each file. This is critical for Code Charter's call graph generation capabilities.

## Acceptance Criteria

- [ ] ScopeGraph is accessible via Project.get_scope_graph() method
- [ ] ScopeGraph is accessible via Project.get_all_scope_graphs() method
- [ ] Both methods have proper TypeScript type definitions
- [ ] Methods handle non-existent files gracefully
- [ ] Unit tests cover both methods

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
