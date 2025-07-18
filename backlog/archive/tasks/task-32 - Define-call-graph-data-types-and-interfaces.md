---
id: task-32
title: Define call graph data types and interfaces
status: Done
assignee: []
created_date: "2025-07-18"
updated_date: "2025-07-18"
labels: []
dependencies: []
---

## Description

Create TypeScript interfaces and types required for the call graph API, including Definition, Call, CallGraph, and related types that will be used across all call graph features. See if these can be 'merged' with the existing types in the project (in graph.ts) or we need to create new types.

## Acceptance Criteria

- [x] TypeScript interfaces defined for Definition type
- [x] TypeScript interfaces defined for Call type
- [x] TypeScript interfaces defined for CallGraph and related types
- [x] Types align with existing RefScope conventions
- [x] Types support all required use cases from requirements

## Implementation Plan

1. Analyze existing types in graph.ts and requirements
2. Write decision document comparing approaches
3. Extend Def interface with optional fields (enclosing_range, signature, docstring)
4. Create new call graph specific types (Call, CallGraph, CallGraphNode, CallGraphEdge, CallGraphOptions)
5. Ensure all types use consistent naming and existing conventions
6. Add JSDoc documentation for all new types and fields
7. Export new types from graph.ts

## Implementation Notes

Implemented a hybrid approach for call graph types:

1. Extended existing Def interface with optional fields (enclosing_range, signature, docstring)
2. Created new call graph specific types: Call, CallGraphOptions, CallGraphNode, CallGraphEdge, CallGraph
3. Reused existing types where appropriate (Def, SimpleRange)
4. Added comprehensive JSDoc documentation for all new types
5. Created decision document explaining the rationale for the hybrid approach

The implementation ensures compatibility with existing code while providing clean interfaces for the call graph API. All types compile successfully and are ready for use in implementing the call graph functionality.

## Reference Types

### Definition Interface

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

### Call Interface

```typescript
interface Call {
  symbol: string; // Symbol being called
  range: Range; // Location of the call
  kind: "function" | "method" | "constructor";
  resolved?: Definition; // The definition being called (if resolved)
}
```

### CallGraph Types

```typescript
interface CallGraphOptions {
  include_external?: boolean; // Include calls to external libraries
  max_depth?: number; // Limit recursion depth
  file_filter?: (path: string) => boolean; // Filter which files to analyze
}

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

## Decision Document

See [Call Graph Types Decision](/Users/chuck/workspace/refscope/backlog/decisions/call-graph-types-decision.md) for the analysis and rationale behind the type design choices.
