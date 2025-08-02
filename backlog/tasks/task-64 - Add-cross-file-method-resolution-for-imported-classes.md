---
id: task-64
title: Add cross-file method resolution for imported classes
status: In Progress
assignee: ['@assistant']
created_date: '2025-08-01'
labels: ['enhancement', 'blocked']
dependencies: []
---

## Description

Currently, method calls on instances of imported classes are not resolved correctly in the call graph. When a class is imported from another file and instantiated, subsequent method calls on that instance are not linked to the method definitions in the original class. This causes methods to incorrectly appear as top-level nodes in the call graph.

## Acceptance Criteria

- [ ] Method calls on imported class instances are correctly resolved to their definitions
- [ ] Call graph correctly links cross-file method calls
- [ ] Methods called via imported class instances are not marked as top-level nodes
- [ ] Tests demonstrate cross-file method resolution working

## Problem Analysis

Currently, when analyzing code like:

```typescript
// File: scope_resolution.ts
import { ScopeGraph } from "./graph";

export function build_scope_graph() {
  const graph = new ScopeGraph();
  graph.insert_global_def(def);  // This method call is not resolved
}
```

The call to `insert_global_def` is not being linked to the method definition in the `ScopeGraph` class, causing:

1. `insert_global_def` appears as a top-level node (never called)
2. `build_scope_graph` shows 0 outgoing calls instead of 1
3. The call graph is incomplete

## Root Cause

The current implementation:

1. Resolves the import `ScopeGraph` to the class definition
2. Tracks `new ScopeGraph()` as a constructor call
3. But does NOT track that the variable `graph` is an instance of `ScopeGraph`
4. When resolving `graph.insert_global_def()`, it only looks for a local definition of `graph`, not its type

## Implementation Plan

1. **Add instance type tracking**:
   - When we see `new ClassName()`, track that the assigned variable is an instance of `ClassName`
   - Store this type information in a map: `variable_name -> class_name`

2. **Enhance method call resolution**:
   - When resolving a method call like `obj.method()`:
     - First resolve `obj` to its definition
     - Check if `obj` has associated type information
     - If it's an instance of a class, resolve the class (possibly through imports)
     - Look up the method in the class definition

3. **Update `get_calls_from_definition`**:
   - Add logic to track variable types from constructor calls
   - Enhance the method resolution logic to use type information

4. **Handle edge cases**:
   - Method calls after variable reassignment
   - Method calls on objects passed as parameters
   - Chained method calls (`obj.method1().method2()`)

## Technical Details

Key areas to modify:

- `project_call_graph.ts`: Add type tracking in `get_calls_from_definition()`
- Consider adding a `variable_types` map to track `variable -> className` mappings
- When we see a constructor call pattern, store the type
- When resolving method references, check the variable's type and resolve through the class

## Example Implementation Approach

```typescript
// In get_calls_from_definition
const variableTypes = new Map<string, string>(); // variable name -> class name

// When we see: const graph = new ScopeGraph()
// Track: variableTypes.set("graph", "ScopeGraph")

// When we see: graph.insert_global_def()
// 1. Resolve "graph" -> variable definition
// 2. Check variableTypes.get("graph") -> "ScopeGraph"
// 3. Resolve "ScopeGraph" (possibly through imports)
// 4. Find method "insert_global_def" in the ScopeGraph class
// 5. Create the function call link
```

## Implementation Notes

After investigation, we discovered that the current tree-sitter scope queries have a fundamental limitation:

1. **Method properties are not captured as references**: When parsing `obj.method()`, only `obj` is captured as a reference, not `method`
2. **The scopes.scm patterns exist but don't work as expected**: The pattern `(call_expression (member_expression ... property: (property_identifier) @local.reference.method))` exists but the method properties aren't being captured
3. **Scope resolution only tracks identifier references**: The system is designed to track references to identifiers, not property accesses

### Attempted Solution

We implemented:
- Variable type tracking when `new ClassName()` is called
- Logic to resolve method calls using type information
- Tests demonstrating the issue

However, the method references are never captured by the tree-sitter queries in the first place, so our resolution logic never runs.

### Required Changes

To properly fix this issue, we would need to:

1. **Modify tree-sitter queries**: Ensure method properties in member expressions are captured as references
2. **Update scope resolution**: Handle method references differently from regular identifier references
3. **Enhance reference tracking**: Track the object and property separately for method calls
4. **Update symbol resolution**: Use type information to resolve method references to their definitions

This is a significant architectural change that affects the core scope resolution system.
