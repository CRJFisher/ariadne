# Task 11.62.1: Create symbols for all entities during per-file analysis

**Status:** Draft
**Parent:** task-11.62
**Epic:** epic-11
**Priority:** High

## Summary

Add symbol creation for all code entities (functions, classes, methods, variables) during the per-file analysis phase. Each entity needs a globally unique SymbolId that can be used for cross-file resolution and linking to scopes.

## Problem

Currently, entities are extracted during per-file analysis but don't have globally unique symbols. This prevents:
- Cross-file symbol resolution
- Linking entities to their containing scopes
- Building a global symbol index
- Connecting references to definitions

## Requirements

### Functional Requirements

1. **Symbol Creation**
   - Create SymbolId for each function using `construct_function_symbol()`
   - Create SymbolId for each class using `construct_class_symbol()`
   - Create SymbolId for each method using `construct_method_symbol()`
   - Create SymbolId for each variable using `construct_variable_symbol()`
   - Handle anonymous functions with location-based symbols

2. **Scope Path Extraction**
   - Extract scope path from scope tree for each entity
   - Build hierarchical scope paths (e.g., ['User', 'validate'])
   - Link entities to their containing scope nodes

3. **Entity Enhancement**
   - Add `symbol_id` field to FunctionInfo
   - Add `symbol_id` field to ClassInfo
   - Add `symbol_id` field to MethodInfo
   - Add `scope_id` field to link to scope tree

### Technical Requirements

- Use existing `symbol_construction.ts` utilities
- Maintain backward compatibility with existing code
- Ensure symbols are created consistently across languages

## Solution Design

### 1. Update Entity Extraction in code_graph.ts

```typescript
// When extracting functions
for (const [scope_id, scope] of scopes.nodes.entries()) {
  if (scope.type === "function") {
    const scope_path = build_scope_path(scope, scopes);
    const symbol_id = construct_function_symbol(
      file.file_path,
      function_name,
      scope_path
    );
    
    functions.push({
      symbol_id,  // NEW
      scope_id,   // NEW
      name: function_name,
      location,
      signature,
      // ... other fields
    });
  }
}
```

### 2. Add Scope Path Builder

```typescript
function build_scope_path(scope: ScopeNode, tree: ScopeTree): string[] {
  const path: string[] = [];
  let current = scope;
  
  while (current.parent_id) {
    const parent = tree.nodes.get(current.parent_id);
    if (!parent) break;
    
    if (parent.metadata?.name && parent.type !== 'global') {
      path.unshift(parent.metadata.name);
    }
    current = parent;
  }
  
  return path;
}
```

### 3. Update Type Definitions

The types are defined in @ariadnejs/types, which are readonly. We need to:
- Store symbols in a separate map during analysis
- Create a symbol registry that maps entities to symbols

## Implementation Steps

1. Create helper functions for scope path extraction
2. Update function extraction to create symbols
3. Update class extraction to create symbols
4. Update method extraction to create symbols
5. Update variable extraction to create symbols
6. Create symbol registry to store mappings
7. Add symbols to FileAnalysis output

## Files to Modify

- `packages/core/src/code_graph.ts` - Add symbol creation
- `packages/core/src/utils/scope_path_builder.ts` - NEW: Extract scope paths
- `packages/core/src/symbol_registry/index.ts` - NEW: Store symbol mappings

## Testing

- Verify symbols are unique across files
- Test anonymous function symbol creation
- Validate scope path extraction
- Check cross-file symbol consistency

## Acceptance Criteria

- [x] All functions have unique SymbolIds
- [x] All classes have unique SymbolIds
- [x] All methods have unique SymbolIds with class scope
- [x] Symbols follow the schema: `<file>#<scope>:<name>`
- [x] Anonymous functions use location-based symbols
- [x] Scope paths correctly represent nesting
- [x] Symbol registry maps entities to symbols

## Dependencies

- Requires `symbol_construction.ts` utilities
- Depends on scope tree being built first
- Must complete before global symbol resolution (11.62.2)

## Implementation Notes

### Completed Implementation (2025-08-31)

1. **Created scope_path_builder.ts** - Utilities for extracting hierarchical scope paths from the scope tree
   - `build_scope_path()` - Gets parent scope names
   - `build_full_scope_path()` - Includes the scope's own name
   - Helper functions for navigation and depth calculation

2. **Updated code_graph.ts** - Added symbol creation for all entities:
   - Functions: Create symbols using `construct_function_symbol()`
   - Methods: Create symbols using `construct_method_symbol()` with class scope
   - Classes: Create symbols using `construct_class_symbol()`
   - Variables: Create symbols using `construct_variable_symbol()` with full scope path
   - Anonymous entities use `SPECIAL_SYMBOLS.ANONYMOUS`

3. **Symbol Registry** - Created Map<any, SymbolId> to track all entity-to-symbol mappings
   - Stored in FileAnalysis for later use
   - Can be accessed by global assembly phase

4. **Fixed scope location references** - Updated from `scope.range` to `scope.location` to match new types

### Notes

This is the foundation for connecting all entities to the global symbol system. Once symbols are created, they can be used for:
- Cross-file resolution
- Call graph construction with proper targets
- Type flow across files
- IDE features like go-to-definition

### Known Issues

- Static method detection not yet implemented
- Property symbols not created (properties not extracted yet)
- Some type mismatches remain with readonly types from @ariadnejs/types
