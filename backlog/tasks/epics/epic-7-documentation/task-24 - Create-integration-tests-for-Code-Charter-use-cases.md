---
id: task-24
title: Create integration tests for Code Charter use cases
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies:
  - task-17
  - task-18
  - task-19
  - task-20
  - task-21
  - task-22
---

## Description

Write integration tests that demonstrate the complete Code Charter workflow from the proposal including call graph building and source extraction.

## Acceptance Criteria

- [ ] Test covers complete Code Charter example from proposal
- [ ] Test builds call graph for multi-file project
- [ ] Test extracts function sources with context
- [ ] Test filters out test functions correctly
- [ ] Performance benchmarks included

## Code Charter Example from Enhancement Proposal

```typescript
// Build complete call graph for visualization
const project = new Project();
// Add all Python files
for (const file of python_files) {
    project.add_or_update_file(file, content);
}

// Get all functions (excluding tests)
const all_functions = project.get_all_functions({
    include_tests: false,
    include_private: false
});

// Build call graph
const call_graph = project.extract_call_graph();

// For each function, get source for LLM summarization
for (const func of call_graph.functions) {
    const source = project.get_source_with_context(func);
    // Send to LLM for summarization
}

// Generate visualization data
const viz_nodes = call_graph.functions.map(f => ({
    id: `${f.file}#${f.name}`,
    label: f.name,
    size: f.metadata.line_count,
    is_async: f.metadata.is_async
}));

const viz_edges = call_graph.calls.map(c => ({
    source: `${c.caller_def.file}#${c.caller_def.name}`,
    target: `${c.called_def.file}#${c.called_def.name}`
}));
```

This integration test should verify that all the above operations work correctly end-to-end.
