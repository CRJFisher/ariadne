---
id: task-21
title: Add function metadata support
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies:
  - task-18
---

## Description

Enhance Def objects with metadata about function characteristics like async status, test detection, complexity, and parameter information. This enables Code Charter to provide rich visualizations and smart filtering.

## Acceptance Criteria

- [ ] FunctionMetadata interface is defined with all specified fields
- [ ] Function definitions include metadata property
- [ ] Metadata correctly identifies async functions
- [ ] Metadata correctly identifies test functions
- [ ] Metadata correctly identifies private functions
- [ ] Metadata includes line count and parameter names
- [ ] Unit tests verify metadata accuracy

## Proposed API from Enhancement Proposal

```typescript
interface FunctionMetadata {
    is_async?: boolean;
    is_test?: boolean;         // Detected test function
    is_private?: boolean;       // Starts with _ in Python
    complexity?: number;        // Cyclomatic complexity
    line_count: number;         // Size of function
    parameter_names?: string[]; // For signature display
    has_decorator?: boolean;    // Python decorators
    class_name?: string;        // For methods, the containing class
}

interface FunctionDef extends Def {
    metadata: FunctionMetadata;
}
```

## Code Charter Use Cases

- **Visualization Styling**: Show async functions differently, size nodes by complexity
- **Smart Filtering**: Hide test/private functions by default in visualizations
- **Rich Tooltips**: Display function signatures and metadata on hover
