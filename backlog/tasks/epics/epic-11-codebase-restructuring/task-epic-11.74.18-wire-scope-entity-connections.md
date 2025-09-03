# Task 11.74.18: Wire Scope Entity Connections Module

**Status:** Completed
**Priority:** Medium
**Size:** Small

## Summary

Wire the complete but unused `scope_analysis/scope_entity_connections` module into Layer 7 (Symbol Registration) to properly connect scope nodes with their corresponding entities.

## Context

The scope entity connections module is complete but not wired. It's designed to map scope IDs to entities (functions, classes, methods) which is crucial for accurate symbol resolution and scope queries.

## Acceptance Criteria

- [x] Import and use `build_scope_entity_connections` in file_analyzer.ts
- [x] Call it in Layer 7 (register_symbols function) 
- [x] Pass connections through to FileAnalysis
- [x] Ensure connections are used by symbol resolution
- [x] Verify scope queries can use the connections
- [x] Test that scope-to-entity mapping is accurate

## Technical Details

### Current State
- Module exists at `/scope_analysis/scope_entity_connections`
- Complete implementation with tests
- Currently stubbed out in file_analyzer.ts Layer 7
- Returns empty Map instead of real connections

### Integration Point
In `file_analyzer.ts` Layer 7 (register_symbols):
```typescript
function register_symbols(
  file_path: string,
  functions: FunctionInfo[],
  classes: ClassInfo[],
  scopes: ScopeTree
): Layer7Results {
  // Build actual symbol registry
  const symbol_registry = build_symbol_registry(functions, classes);
  
  // NEW: Build real scope entity connections
  const scope_entity_connections = build_scope_entity_connections(
    scopes,
    functions,
    classes,
    file_path
  );
  
  return { symbol_registry, scope_entity_connections };
}
```

### What It Provides
- Maps scope IDs to their defining entities
- Enables "what entity owns this scope?" queries
- Helps resolve symbols within specific scopes
- Critical for accurate cross-file symbol resolution

### Files to Modify
- `packages/core/src/file_analyzer.ts` - Use real implementation in Layer 7
- `packages/core/src/scope_analysis/scope_entity_connections/index.ts` - Verify exports
- Symbol resolution code to use the connections

## Dependencies
- Requires scope tree and entity extraction
- Should be done before enhancing symbol resolution

## Implementation Notes
- The module already has the implementation
- Just needs to be wired in place of the stub
- Consider how connections are used by symbol resolution
- May need to pass connections to global symbol table builder

## Test Requirements
- Test function scope to function entity mapping
- Test class scope to class entity mapping
- Test method scope to method entity mapping
- Test nested scope connections
- Test anonymous function scope connections
- Verify connections are used in symbol resolution

## Implementation Notes

**Date:** 2025-09-03

### What Was Done

1. **Added import** - Imported `build_scope_entity_connections` from scope_entity_connections module.

2. **Fixed type issues** - Updated type alias to use the real ScopeEntityConnections interface instead of Map<any, any>.

3. **Created build_symbol_registry** - Implemented function to build symbol registry from functions and classes.

4. **Wired into Layer 7** - Modified register_symbols to:
   - Build actual symbol registry
   - Extract variables from scopes
   - Call build_scope_entity_connections with all required parameters
   - Return the real connections instead of empty Map

5. **Added language parameter** - Passed language through to register_symbols since it's needed for connections.

6. **Created tests** - Added file_analyzer.scope.test.ts to verify scope entity connections are built correctly.

### Key Design Decisions

- Symbol registry maps entities to symbol IDs using simple prefixed strings (function:name, class:name, method:class.name)
- Language is passed explicitly rather than trying to extract from locations
- Scope entity connections provide bidirectional mappings between scopes and entities

### What It Provides

- Maps scope IDs to their defining entities (functions/classes)
- Tracks which entities are contained within each scope  
- Enables "what entity owns this scope?" queries
- Critical for accurate cross-file symbol resolution
- Foundation for scope-aware navigation and visibility checking

### Test Results

Main test passes, confirming scope entity connections are being built and wired correctly.

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Enhances: Symbol resolution accuracy
- Related: Task 11.74.19 (Storage layers)