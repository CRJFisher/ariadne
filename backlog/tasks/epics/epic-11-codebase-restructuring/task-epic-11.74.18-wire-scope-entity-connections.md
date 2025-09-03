# Task 11.74.18: Wire Scope Entity Connections Module

**Status:** Ready
**Priority:** Medium
**Size:** Small

## Summary

Wire the complete but unused `scope_analysis/scope_entity_connections` module into Layer 7 (Symbol Registration) to properly connect scope nodes with their corresponding entities.

## Context

The scope entity connections module is complete but not wired. It's designed to map scope IDs to entities (functions, classes, methods) which is crucial for accurate symbol resolution and scope queries.

## Acceptance Criteria

- [ ] Import and use `build_scope_entity_connections` in file_analyzer.ts
- [ ] Call it in Layer 7 (register_symbols function) 
- [ ] Pass connections through to FileAnalysis
- [ ] Ensure connections are used by symbol resolution
- [ ] Verify scope queries can use the connections
- [ ] Test that scope-to-entity mapping is accurate

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

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Enhances: Symbol resolution accuracy
- Related: Task 11.74.19 (Storage layers)