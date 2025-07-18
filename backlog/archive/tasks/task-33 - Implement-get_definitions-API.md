---
id: task-33
title: Implement get_definitions API
status: Done
assignee:
  - "@claude"
created_date: "2025-07-18"
updated_date: "2025-07-18"
labels: []
dependencies:
  - task-32
---

## Description

Implement the get_definitions API that returns all definitions (functions, methods, classes) in a file. This is a core building block for call graph analysis.

## Acceptance Criteria

- [x] API function get_definitions implemented
- [x] Returns all function definitions in a file
- [x] Returns all method definitions in a file
- [x] Returns all class definitions in a file
- [x] Includes enclosing ranges for each definition
- [x] Includes signatures and docstrings when available
- [x] Works with TypeScript files
- [x] Works with JavaScript files
- [x] Unit tests cover all definition types

## Implementation Plan

1. Analyze the codebase to understand the existing TypeScript AST parsing setup
2. Create the get_definitions function in the appropriate module
3. Implement TypeScript definition extraction (functions, methods, classes)
4. Implement JavaScript definition extraction
5. Extract enclosing ranges for each definition
6. Extract signatures and docstrings
7. Write comprehensive unit tests
8. Ensure proper error handling and edge cases

## API Specification

### Function Signature

```typescript
get_definitions(file_path: string): Def[]
```

### Return Type

Uses the existing `Def` interface from `graph.ts`, which was extended per the decision in `call-graph-types-decision.md`:

```typescript
export interface Def extends BaseNode {
  kind: 'definition';
  name: string;
  symbol_kind: string; // e.g., 'function', 'class', 'variable'
  file_path: string;
  symbol_id: string;
  metadata?: FunctionMetadata;
  enclosing_range?: SimpleRange; // Full body range including definition
  signature?: string;             // Full signature with parameters
  docstring?: string;             // Documentation comment if available
  // ... other fields
}
```

### Use Cases

- Building file outlines
- Analyzing code structure
- Custom filtering of definitions
- Incremental call graph construction

## Implementation Notes

### Approach taken

Implemented the get_definitions API as both a method on the Project class and as a standalone function. The implementation leverages the existing tree-sitter AST parsing infrastructure and scope graph building. Following the decision in `call-graph-types-decision.md`, we reused the existing `Def` type rather than creating a new `Definition` interface.

### Features implemented

1. **Project.get_definitions()** method - Returns all definitions from a file's scope graph
2. **get_definitions()** standalone function - Creates a temporary Project instance to parse and analyze a single file
3. **Reused existing Def type** - Per the decision in `call-graph-types-decision.md`, used the existing Def interface which already had the required fields (enclosing_range, signature, docstring)
4. **Comprehensive support** - Returns all types of definitions including functions, methods, classes, variables, constants, parameters, etc.

### Technical decisions and trade-offs

- **Broad definition support**: Rather than filtering to only functions/methods/classes, the implementation returns all definitions and lets the caller filter by symbol_kind. This provides more flexibility.
- **Reuse existing infrastructure**: Leveraged the existing ScopeGraph and Def types as recommended in the decision document
- **No type mapping needed**: Since we're using the existing Def type directly, no conversion is required
- **Error handling**: Returns empty array for non-existent files with console error logging

### Modified or added files

- **src/index.ts**: Added Project.get_definitions() method and get_definitions() standalone function (both return Def[])
- **src/index.test.ts**: Added comprehensive test suites for both the Project method and standalone function

### Notes on symbol kinds

- Functions: `symbol_kind === 'function'`
- Methods: `symbol_kind === 'method'`
- Classes: `symbol_kind === 'class'`
- Arrow functions assigned to const: `symbol_kind === 'constant'`
- Variables: `symbol_kind === 'variable'`
- Parameters: `symbol_kind === 'parameter'`
- Generators: `symbol_kind === 'generator'`
