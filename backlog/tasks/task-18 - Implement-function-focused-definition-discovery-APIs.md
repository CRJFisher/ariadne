---
id: task-18
title: Implement function-focused definition discovery APIs
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Add methods to the Project class to easily discover all function and method definitions in files, with filtering options for test functions and private functions. This enables Code Charter to build call graphs efficiently.

## Acceptance Criteria

- [ ] Project.get_functions_in_file() method implemented and returns all functions in a file
- [ ] Project.get_all_functions() method implemented with filtering options
- [ ] Filtering options include include_private include_tests and symbol_kinds
- [ ] Methods properly identify function vs method definitions
- [ ] Unit tests cover all filtering scenarios

## Proposed API from Enhancement Proposal

```typescript
class Project {
    // Get all function and method definitions in a file
    get_functions_in_file(file_path: string): Def[];
    
    // Get all functions across the project with filtering
    get_all_functions(options?: {
        include_private?: boolean;  // Include _private functions
        include_tests?: boolean;     // Include test_* functions
        symbol_kinds?: string[];     // ['function', 'method']
    }): Map<string, Def[]>;
}
```

## Code Charter Use Cases

- **Entry Point Detection**: Find top-level functions to show as starting points in the visualization
- **Test Filtering**: Exclude test functions from production code analysis
- **API Surface Detection**: Focus on public functions for documentation
