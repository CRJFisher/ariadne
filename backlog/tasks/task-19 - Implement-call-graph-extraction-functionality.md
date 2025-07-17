---
id: task-19
title: Implement call graph extraction functionality
status: Done
assignee:
  - "@chuck"
created_date: "2025-07-17"
updated_date: "2025-07-17"
labels: []
dependencies:
  - task-17
  - task-18
---

## Description

Create APIs to extract function call relationships and build complete call graphs. This is the core functionality needed by Code Charter for visualizing code structure.

## Acceptance Criteria

- [x] FunctionCall interface is defined with all required fields
- [x] Project.get_function_calls() method returns calls made by a specific function
- [x] Project.extract_call_graph() returns complete project call graph
- [x] Method calls are distinguished from function calls
- [x] Call locations are accurately tracked
- [x] Unit tests verify call graph accuracy

## Proposed API from Enhancement Proposal

```typescript
interface FunctionCall {
  caller_def: Def; // The function making the call
  called_def: Def; // The function being called
  call_location: Point; // Where in the caller the call happens
  is_method_call: boolean; // true for self.method() or this.method()
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

## Implementation Plan

1. Define FunctionCall interface with required fields
2. Implement get_function_calls() method in Project class
3. Create helper methods to parse function calls from AST nodes
4. Implement extract_call_graph() to build complete project call graph
5. Add logic to distinguish method calls from function calls
6. Write comprehensive unit tests for call graph extraction

## Implementation Notes

Implemented call graph extraction functionality with the following components:

### Core Implementation

1. **FunctionCall Interface** (graph.ts)

   - Added interface with all required fields: caller_def, called_def, call_location, is_method_call
   - Exported through public API

2. **Call Extraction Methods** (index.ts)

   - **get_function_calls(def)**: Extracts all calls made by a specific function
   - **extract_call_graph()**: Builds complete project call graph
   - **is_position_within_range()**: Helper to check if a position falls within a range

3. **Method Call Detection**
   - Updated scope queries for TypeScript, JavaScript, and Python to capture method calls
   - Added patterns to detect this.method() and self.method() calls
   - Excluded super.method() calls to avoid incorrect parent class references

### Technical Decisions

- Method calls are detected both through AST patterns and reference resolution
- Call location tracking uses the exact position of the call expression
- Super method calls are explicitly excluded as they reference parent implementations

### Testing

Created comprehensive test suite (call_graph.test.ts) covering:

- Basic function call extraction
- Method call detection
- Cross-file call resolution
- Complete call graph extraction
- Edge cases and error handling

Modified files:

- src/graph.ts: Added FunctionCall interface
- src/index.ts: Added call graph extraction methods
- src/call_graph.test.ts: New comprehensive test suite
- src/languages/typescript/scopes.scm: Added method call pattern
- src/languages/javascript/scopes.scm: Added method call pattern
- src/languages/python/scopes.scm: Added method call pattern

### Post-Implementation Test Fixes

After completing the initial implementation, several test failures were discovered and fixed:

1. **Method Definition Resolution** - Changed method definitions from `@local.definition.method` to `@hoist.definition.method` in TypeScript scope query to make methods accessible from outside their class scope.

2. **Import Symbol Kind** - Modified symbol resolver to return import statements with `symbol_kind: 'import'` instead of resolving to cross-file function definitions.

3. **Reference Counting** - Added patterns to capture:

   - Function value references in variable declarations (`const fn = testFunc`)
   - Property accesses in class methods (`this.value`)
   - Fixed duplicate method call detection by making property access patterns more specific

4. **Python Method Call Detection** - Added fallback logic in `get_function_calls()` to detect Python method calls when tree-sitter patterns don't properly mark them.

These fixes ensured all 111 tests pass successfully, confirming the robustness of the RefScope API implementation.
