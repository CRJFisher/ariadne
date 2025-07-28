# Call Graph Types Decision

**Date**: 2025-07-18  
**Status**: Accepted  
**Author**: Assistant  
**Related Tasks**: task-32, task-35

## Context

Ariadne needs to implement a call graph API to support native call graph analysis. This requires defining TypeScript interfaces for Definition, Call, CallGraph, and related types. We need to decide whether to:

1. Expand existing types in `graph.ts`
2. Create separate new types specifically for call graphs
3. Use a hybrid approach

## Existing Type Analysis

### Current Types in graph.ts

1. **`Def` (Definition)**:

   - Already captures: name, symbol_kind, file_path, range, metadata
   - Has `FunctionMetadata` for function-specific details
   - Supports all definition types (function, class, variable)

2. **`FunctionCall`**:

   - Already captures: caller_def, called_def, call_location, is_method_call
   - Represents function call relationships

3. **`ImportInfo`**:

   - Maps imports to their actual definitions
   - Supports cross-file resolution

4. **`ScopeGraph`**:
   - Manages the scope hierarchy and symbol resolution
   - Contains all definitions, references, and imports

### Required Types from Requirements

1. **`Definition`** (from requirements):

   - name, kind, range, file, enclosing_range, signature, docstring
   - Very similar to existing `Def` type

2. **`Call`** (from requirements):

   - symbol, range, kind, resolved (optional Definition)
   - Partially overlaps with `FunctionCall` but different structure

3. **`CallGraph`**, `CallGraphNode`**, `CallGraphEdge`**:
   - New types not present in existing codebase
   - Represent the graph structure and filtering options

## Decision

**Use a hybrid approach**: Reuse and extend existing types where possible, create new types for call-graph-specific structures.

### Rationale

1. **Maximize Code Reuse**: The existing `Def` type already captures most of what the `Definition` interface needs. Adding a few optional fields is better than duplicating the type.

2. **Maintain Compatibility**: By extending rather than replacing, we preserve all existing functionality and avoid breaking changes.

3. **Clear Separation**: Call graph specific types (`CallGraph`, `CallGraphNode`, etc.) are new concepts that deserve their own types.

4. **Type Safety**: Using distinct types for different purposes (e.g., `FunctionCall` vs `Call`) provides better type safety even if they share similar data.

## Implementation Plan

### 1. Extend Existing Types

```typescript
// Extend Def to include additional fields needed for call graph
export interface Def extends BaseNode {
  // ... existing fields ...
  enclosing_range?: SimpleRange; // Full body range including definition
  signature?: string; // Full signature with parameters
  docstring?: string; // Documentation comment if available
}
```

### 2. Create Call Graph Specific Types

```typescript
// New call graph specific types
export interface Call {
  symbol: string;
  range: SimpleRange;
  kind: "function" | "method" | "constructor";
  resolved?: Def; // Use existing Def type
}

export interface CallGraphOptions {
  include_external?: boolean;
  max_depth?: number;
  file_filter?: (path: string) => boolean;
}

export interface CallGraphNode {
  symbol: string;
  definition: Def; // Reuse existing Def
  calls: Call[];
  called_by: string[];
}

export interface CallGraphEdge {
  from: string;
  to: string;
  location: SimpleRange;
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallGraphEdge[];
  top_level_nodes: string[];
}
```

### 3. Type Mapping Strategy

- `Definition` → Use extended `Def` type
- `FunctionCall` → Keep for internal use, convert to `Call` for API
- `Range` → Use existing `SimpleRange` type
- Symbol naming: Implement consistent `<file_path>#<name>` format

## Benefits

1. **Minimal Breaking Changes**: Existing code continues to work
2. **Single Source of Truth**: One definition type used throughout
3. **Clear API Surface**: New types clearly indicate call graph functionality
4. **Future Flexibility**: Can evolve call graph types independently

## Risks and Mitigations

1. **Risk**: Type confusion between `FunctionCall` and `Call`

   - **Mitigation**: Clear documentation and conversion functions

2. **Risk**: Optional fields on `Def` may not always be populated
   - **Mitigation**: Document when fields are guaranteed to be present

## Alternatives Considered

1. **Pure Extension**: Only extend existing types

   - Rejected: Would pollute existing types with call-graph-specific concerns

2. **Complete Separation**: All new types

   - Rejected: Would duplicate much of the existing type structure

3. **Type Aliases**: Use type aliases to map between systems
   - Rejected: Less clear than explicit types

## References

- [Ariadne Call Graph API Requirements](/Users/chuck/workspace/refscope/backlog/drafts/refscope-call-graph-api-requirements.md)
- [Existing graph.ts implementation](/Users/chuck/workspace/refscope/src/graph.ts)
