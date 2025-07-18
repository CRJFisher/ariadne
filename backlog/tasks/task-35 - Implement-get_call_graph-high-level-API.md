---
id: task-35
title: Implement get_call_graph high-level API
status: To Do
assignee: []
created_date: "2025-07-18"
labels: []
dependencies:
  - task-32
  - task-33
  - task-34
  - task-40
---

## Description

Implement the get_call_graph API that builds a complete call graph for the project. This convenience API uses the low-level building blocks to construct a full graph.

## Acceptance Criteria

- [ ] API function get_call_graph implemented
- [ ] Builds complete call graph using low-level APIs
- [ ] Supports CallGraphOptions for filtering
- [ ] Correctly constructs nodes with definitions and calls
- [ ] Correctly constructs edges between caller and callee
- [ ] Identifies top-level nodes not called by others
- [ ] Supports include_external option for library calls
- [ ] Supports max_depth option for recursion limiting
- [ ] Supports file_filter option for selective analysis
- [ ] Returns CallGraph structure with nodes and edges
- [ ] Unit tests verify graph construction
- [ ] Integration tests verify multi-file graphs

### Testing

- [ ] Multi-file TypeScript project test cases
- [ ] Multi-file JavaScript project test cases
- [ ] Cross-file import/export resolution tests
- [ ] Circular dependency detection tests
- [ ] Large codebase performance tests
- [ ] Mixed language project tests if applicable
- [ ] Test fixtures represent real-world patterns
- [ ] Tests verify graph completeness
- [ ] Tests verify graph accuracy
- [ ] Edge cases and error scenarios covered
- [ ] Test documentation explains scenarios
- [ ] CI integration for automated testing

## API Specification

### Function Signature

```typescript
get_call_graph(options?: CallGraphOptions): CallGraph
```

### Options Type

```typescript
interface CallGraphOptions {
  include_external?: boolean; // Include calls to external libraries
  max_depth?: number; // Limit recursion depth
  file_filter?: (path: string) => boolean; // Filter which files to analyze
}
```

### Return Type

```typescript
interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallGraphEdge[];
  top_level_nodes: string[]; // Symbols not called by others
}

interface CallGraphNode {
  symbol: string;
  definition: Definition;
  calls: Call[]; // Outgoing calls from this node
  called_by: string[]; // Incoming calls (symbol names)
}

interface CallGraphEdge {
  from: string; // Caller symbol
  to: string; // Callee symbol
  location: Range; // Where the call occurs
}
```
