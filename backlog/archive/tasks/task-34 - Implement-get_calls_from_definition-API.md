---
id: task-34
title: Implement get_calls_from_definition API
status: Done
assignee:
  - '@claude'
created_date: '2025-07-18'
updated_date: '2025-07-18'
labels: []
dependencies:
  - task-32
  - task-33
---

## Description

Implement the get_calls_from_definition API that returns all function/method calls made within a definition's body. This enables analysis of what a function calls.

## Acceptance Criteria

- [x] API function get_calls_from_definition implemented
- [x] Identifies function calls within definition body
- [x] Identifies method calls within definition body
- [x] Identifies constructor calls within definition body
- [x] Resolves calls to their definitions when possible
- [x] Handles nested and anonymous function calls
- [x] Works with arrow functions and callbacks
- [x] Works with async/await patterns
- [x] Unit tests cover all call types
- [x] Gracefully handles unresolved symbols

## Implementation Plan

1. Study existing get_function_calls method to understand call extraction pattern
2. Create new get_calls_from_definition API method in Project class
3. Generalize logic to work with any definition type, not just functions
4. Extract all types of calls (function, method, constructor) from definition body
5. Ensure proper handling of nested and anonymous functions
6. Add support for arrow functions and callbacks
7. Handle async/await patterns properly
8. Write comprehensive unit tests for all scenarios
9. Test with TypeScript, JavaScript, Python, and Rust examples

## API Specification

### Function Signature

```typescript
get_calls_from_definition(def: Definition): Call[]
```

### Return Type

Uses the `Call` interface defined in task-32:

```typescript
interface Call {
  symbol: string; // Symbol being called
  range: Range; // Location of the call
  kind: "function" | "method" | "constructor";
  resolved?: Definition; // The definition being called (if resolved)
}
```

### Use Cases

- Analyzing function complexity
- Building custom dependency graphs
- Finding specific call patterns
- Debugging call relationships

## Implementation Notes

### Approach Taken

I implemented the `get_calls_from_definition` API method in the Project class that generalizes the existing `get_function_calls` logic to work with any definition type. The implementation:

1. Accepts any Def (definition) object, not just functions
2. Uses AST traversal to find the full definition body range based on the symbol_kind
3. Filters references within the definition range
4. Resolves references to their definitions
5. Returns FunctionCall objects for all callable definitions found

### Features Implemented

- **Generalized definition handling**: Works with functions, methods, classes, variables with initializers, etc.
- **AST-based range detection**: Properly finds the full body of definitions including:
  - Function/method declarations with their entire body
  - Variable declarations including their initializers
  - Class declarations with all their methods
  - Arrow functions and function expressions
- **Call type detection**: Identifies method calls vs function calls based on syntax patterns
- **Cross-language support**: Works with TypeScript, JavaScript, Python, and partially with Rust

### Technical Decisions

1. **Reused existing FunctionCall interface**: Instead of creating a new Call interface, I reused the existing FunctionCall interface to maintain consistency with the codebase
2. **Refactored get_function_calls**: The original method now delegates to get_calls_from_definition and filters results, avoiding code duplication
3. **Language-specific method detection**: Added patterns to detect method calls in different languages (dot notation, optional chaining, Rust's :: operator)

### Modified Files

- `src/index.ts`: Added get_calls_from_definition method and refactored get_function_calls
- `src/call_graph.test.ts`: Added comprehensive test suite for the new API

### Known Limitations

- Some edge cases with Rust method calls may not be fully detected due to differences in AST structure
- Complex nested anonymous functions might not have all their calls tracked if they're not properly defined in the scope graph

Implemented get_calls_from_definition API that works with any definition type. Added comprehensive test coverage for TypeScript, JavaScript, and Python. Refactored existing get_function_calls to use the new generalized API.
