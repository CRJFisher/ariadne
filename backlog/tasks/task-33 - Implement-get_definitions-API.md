---
id: task-33
title: Implement get_definitions API
status: To Do
assignee: []
created_date: '2025-07-18'
labels: []
dependencies:
  - task-32
---

## Description

Implement the get_definitions API that returns all definitions (functions, methods, classes) in a file. This is a core building block for call graph analysis.

## Acceptance Criteria

- [ ] API function get_definitions implemented
- [ ] Returns all function definitions in a file
- [ ] Returns all method definitions in a file
- [ ] Returns all class definitions in a file
- [ ] Includes enclosing ranges for each definition
- [ ] Includes signatures and docstrings when available
- [ ] Works with TypeScript files
- [ ] Works with JavaScript files
- [ ] Unit tests cover all definition types

## API Specification

### Function Signature
```typescript
get_definitions(file_path: string): Definition[]
```

### Return Type
Uses the `Definition` interface defined in task-32:
```typescript
interface Definition {
  name: string;
  kind: "function" | "method" | "class" | "variable";
  range: Range;
  file: string;
  enclosing_range?: Range; // Full body range including definition
  signature?: string; // Full signature with parameters
  docstring?: string; // Documentation comment if available
}
```

### Use Cases
- Building file outlines
- Analyzing code structure
- Custom filtering of definitions
- Incremental call graph construction
