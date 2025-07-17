---
id: task-22
title: Implement cross-file import resolution
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies: []
---

## Description

Add APIs to resolve import statements to their actual definitions and track which functions are exported from modules. This enables Code Charter to build accurate cross-module call graphs.

## Acceptance Criteria

- [ ] ImportInfo interface is defined with all required fields
- [ ] Project.get_imports_with_definitions() returns resolved imports
- [ ] Project.get_exported_functions() returns module exports
- [ ] Import resolution handles Python imports correctly
- [ ] Import resolution handles TypeScript/JavaScript imports
- [ ] Methods handle circular imports gracefully
- [ ] Unit tests verify import resolution accuracy

## Proposed API from Enhancement Proposal

```typescript
interface ImportInfo {
    imported_function: Def;     // The actual function definition
    import_statement: Import;   // The import node
    local_name: string;         // Name used in importing file
}

class Project {
    // Get all imports in a file with resolved definitions
    get_imports_with_definitions(file_path: string): ImportInfo[];
    
    // Get all functions imported from a specific module
    get_exported_functions(module_path: string): Def[];
}
```

## Code Charter Use Cases

- **Cross-Module Call Graphs**: Track calls across file boundaries accurately
- **Module Dependency Visualization**: Show which modules depend on which functions
- **Public API Analysis**: Identify which functions are used outside their module
