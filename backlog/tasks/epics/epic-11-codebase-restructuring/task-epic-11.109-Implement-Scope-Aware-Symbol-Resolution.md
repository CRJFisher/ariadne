# Task 11.109: Implement Scope-Aware Symbol Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 2-3 weeks
**Parent:** epic-11
**Dependencies:** task-epic-11.105 (Type preprocessing)

## Objective

Transform `resolve_references` to use **lexical scope walking** as the foundation for all symbol resolution. Every name lookup will traverse the scope chain, respecting shadowing and visibility rules. This creates a uniform, correct resolution system that mirrors how programming languages actually work.

## Background

Current resolution happens in ad-hoc phases without unified scope-aware lookup:

- Import resolution doesn't respect local shadowing
- No unified scope walking mechanism
- Method resolution is tightly coupled to type tracking
- Resolution order bugs due to lack of proper scoping

**Core Principle:** Every symbol lookup walks the scope chain from inner to outer scopes, with first match winning (inner scope shadows outer). Imports are only visible at module scope.

## Architecture Overview

```
resolve_references/
├── scope_resolver/
│   └── scope_resolver.ts          # Universal scope-walking algorithm
├── import_resolution/
│   ├── import_resolver.ts         # Cross-file import->export connections
│   └── export_finder.ts           # Find exported symbols
├── type_resolution/
│   ├── type_context.ts            # Type tracking (integrates with 11.105)
│   └── type_tracker.ts            # Variable type tracking
└── call_resolution/
    ├── function_resolver.ts       # Function calls via scope walking
    ├── method_resolver.ts         # Methods via scope + type context
    └── constructor_resolver.ts    # Constructors via scope + type context
```

## Sub-Tasks

### Foundation

- **11.109.1** - Implement Core ScopeResolver (universal scope-walking algorithm)
- **11.109.2** - Implement Import Resolution (cross-file connections)

### Type System

- **11.109.3** - Implement Type Context (integrates with 11.105 preprocessed types)

### Call Resolution

- **11.109.4** - Implement Function Call Resolution (scope-aware)
- **11.109.5** - Implement Method Call Resolution (scope + types)
- **11.109.6** - Implement Constructor Call Resolution (scope + types)

### Integration

- **11.109.7** - Main Orchestration & Pipeline Integration
- **11.109.8** - Comprehensive Testing & Validation
- **11.109.9** - Cleanup Old Code & Documentation

## Key Benefits

1. **Correctness** - Respects lexical scoping (matches actual language semantics)
2. **Simplicity** - One algorithm (ScopeResolver) for all name lookups
3. **Testability** - Each component tested in isolation
4. **Extensibility** - Task 11.105's type preprocessing integrates cleanly
5. **Performance** - Scope walking is O(depth), typically small

## Success Criteria

### Functional

- All name resolution respects lexical scope chains
- Local definitions properly shadow imports
- Method resolution uses type information correctly
- All existing tests pass with new implementation

### Architecture

- Single ScopeResolver used by all resolution phases
- Clear separation: imports → scopes → types → calls
- Type preprocessing from 11.105 integrates seamlessly

### Testing

- ScopeResolver has comprehensive unit tests
- Each resolver tested independently
- Integration tests verify complete resolution pipeline
- Shadowing edge cases covered

## Technical Notes

### Scope Resolution Algorithm

```typescript
function resolve_name(name: SymbolName, scope_id: ScopeId): SymbolId | null {
  current_scope = scope_id;

  while (current_scope != null) {
    // 1. Check local definitions in this scope
    if (definition_exists(name, current_scope)) {
      return definition_symbol_id;
    }

    // 2. If module scope, check imports (only at this level!)
    if (is_module_scope(current_scope)) {
      if (imported_symbol_exists(name)) {
        return imported_symbol_id;
      }
    }

    // 3. Move up to parent scope
    current_scope = parent_scope(current_scope);
  }

  return null; // Not found in any visible scope
}
```

### Integration with Task 11.105

Task 11.105 preprocesses type information in `SemanticIndex`. Integration points:

- Type annotations extracted during indexing
- Type inheritance chains preprocessed
- TypeContext consumes this data for method resolution

## Implementation Strategy

1. **Phase 1: Foundation** - ScopeResolver + ImportResolver with tests
2. **Phase 2: Types** - TypeContext with 11.105 integration
3. **Phase 3: Calls** - Function/Method/Constructor resolvers
4. **Phase 4: Integration** - Wire everything together
5. **Phase 5: Validation** - Comprehensive testing
6. **Phase 6: Cleanup** - Remove old code, update docs

## Dependencies

- **Requires:** SemanticIndex with complete scope trees (✓ available)
- **Requires:** All definitions have scope_id (✓ available)
- **Requires:** All references have scope_id (✓ available)
- **Integrates with:** Task 11.105 type preprocessing (in progress)

## References

- Architecture design document: See full plan in chat history
- Current implementation: `packages/core/src/resolve_references/`
- SemanticIndex API: `packages/core/src/index_single_file/semantic_index.ts`
- Scope types: `packages/types/src/scopes.ts`
