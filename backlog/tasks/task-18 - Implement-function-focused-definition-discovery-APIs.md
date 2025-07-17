---
id: task-18
title: Implement function-focused definition discovery APIs
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Add methods to the Project class to easily discover all function and method definitions in files, with filtering options for test functions and private functions. This enables Code Charter to build call graphs efficiently.

## Acceptance Criteria

- [x] Project.get_functions_in_file() method implemented and returns all functions in a file
- [x] Project.get_all_functions() method implemented with filtering options
- [x] Filtering options include include_private include_tests and symbol_kinds
- [x] Methods properly identify function vs method definitions
- [x] Unit tests cover all filtering scenarios

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

## Implementation Plan

1. Study how definitions are currently identified in ScopeGraph
2. Implement get_functions_in_file() method to return function/method definitions
3. Implement get_all_functions() with filtering options
4. Add logic to identify test functions (test_ prefix, test frameworks)
5. Add logic to identify private functions (_ prefix in Python)
6. Ensure proper distinction between functions and methods
7. Write comprehensive unit tests for all filtering scenarios
8. Update TypeScript types and documentation

## Implementation Notes

Implemented function discovery APIs in the Project class:

- **get_functions_in_file(file_path)**: Returns all function/method definitions in a specific file
- **get_all_functions(options)**: Returns all functions across the project with filtering options

Filtering options implemented:
- **include_private**: Filter functions starting with underscore (default: true)
- **include_tests**: Filter test functions based on naming patterns (default: true)  
- **symbol_kinds**: Specify which definition types to include (default: ['function', 'method', 'generator'])

Helper methods added:
- **is_private_function**: Checks if function name starts with single underscore
- **is_test_function**: Checks for common test function naming patterns

The implementation properly handles edge cases like non-existent files and empty results. Comprehensive unit tests verify all filtering scenarios and edge cases.

Modified files:
- src/index.ts: Added function discovery methods and helpers
- src/index.test.ts: Added test suite for function discovery APIs