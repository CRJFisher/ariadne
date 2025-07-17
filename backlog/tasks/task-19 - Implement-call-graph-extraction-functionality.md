---
id: task-19
title: Implement call graph extraction functionality
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies:
  - task-17
  - task-18
---

## Description

Create APIs to extract function call relationships and build complete call graphs. This is the core functionality needed by Code Charter for visualizing code structure.

## Acceptance Criteria

- [ ] FunctionCall interface is defined with all required fields
- [ ] Project.get_function_calls() method returns calls made by a specific function
- [ ] Project.extract_call_graph() returns complete project call graph
- [ ] Method calls are distinguished from function calls
- [ ] Call locations are accurately tracked
- [ ] Unit tests verify call graph accuracy

## Proposed API from Enhancement Proposal

```typescript
interface FunctionCall {
    caller_def: Def;           // The function making the call
    called_def: Def;           // The function being called
    call_location: Point;      // Where in the caller the call happens
    is_method_call: boolean;   // true for self.method() or this.method()
}

class Project {
    // Get all function calls made by a specific function
    get_function_calls(def: Def): FunctionCall[];
    
    // Get all calls between functions in the project
    extract_call_graph(): {
        functions: Def[];
        calls: FunctionCall[];
    };
}
```

## Code Charter Use Cases

- **Direct Call Graph Building**: Get complete call relationships without manual AST traversal
- **Call Context**: Know exactly where each call happens for accurate source extraction
- **Method vs Function Calls**: Distinguish between different call types for better visualization
