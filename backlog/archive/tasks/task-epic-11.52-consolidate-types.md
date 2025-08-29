# Task: Review, Refine and Consolidate Types

**Epic**: Epic 11 - Codebase Restructuring  
**Priority**: High  
**Status**: Not Started  
**Dependencies**: 
- Should be done after core CodeGraph structure is stable
- Before public API is finalized

## Problem Statement

The new CodeGraph architecture introduces many types (CodeGraph, FileAnalysis, CallGraph, ModuleGraph, etc.). Currently these types are scattered across implementation modules. User-visible types should live in `@ariadnejs/types` package for consistency and clear API boundaries.

## Success Criteria

- [ ] All user-visible types moved to `packages/types`
- [ ] Implementation-only types remain in their modules
- [ ] Clear distinction between public API types and internal types
- [ ] No circular dependencies between packages
- [ ] All imports updated to use `@ariadnejs/types`
- [ ] Type names are consistent and descriptive

## Types to Review and Consolidate

### Currently in code_graph.ts (should move to packages/types)
- `CodeGraph` - Main output structure
- `FileAnalysis` - Per-file results
- `CallGraph`, `FunctionNode`, `CallEdge`
- `ModuleGraph`, `ModuleNode`, `ModuleEdge`
- `ClassHierarchy`, `ClassNode`, `InheritanceEdge`
- `TypeIndex`, `VariableType`, `TypeDefinition`
- `SymbolIndex`, `Definition`, `Usage`
- `Location` - Common location type
- `CodeGraphOptions` - API options

### Currently in query modules (evaluate for public API)
- `CallGraphInfo` - Query result type

### Internal types (keep in implementation modules)
- `InternalFileAnalysis` - Implementation detail
- `*Context` types - Processing contexts
- `*Config` types - Internal configs
- Builder/helper types

## Implementation Plan

1. **Identify Public vs Internal Types**
   - Public: Returned by API functions or passed as parameters
   - Internal: Only used within implementation

2. **Create Type Hierarchy in packages/types**
   ```
   packages/types/src/
   ├── codegraph.ts      # Main CodeGraph types
   ├── modules.ts        # ModuleGraph types
   ├── calls.ts          # CallGraph types
   ├── classes.ts        # ClassHierarchy types
   ├── types.ts          # TypeIndex types
   ├── symbols.ts        # SymbolIndex types
   ├── common.ts         # Shared types (Location, etc.)
   └── index.ts          # Public exports
   ```

3. **Update Imports Throughout Codebase**
   - Replace local type imports with `@ariadnejs/types`
   - Keep internal types local

4. **Ensure Backwards Compatibility**
   - Existing types in packages/types should remain
   - Add new types without breaking changes

5. **Documentation**
   - Add JSDoc comments to all public types
   - Document relationship between types
   - Provide usage examples

## Technical Considerations

- **No Circular Dependencies**: packages/types cannot import from packages/core
- **Type-Only Exports**: Use `export type` to ensure no runtime code
- **Naming Consistency**: Follow existing patterns in packages/types
- **Version Management**: Consider impact on package versioning

## Testing Requirements

- TypeScript compilation must pass
- No runtime errors from type changes
- All existing tests must pass
- Add type tests using `tsd` or similar

## Migration Strategy

1. Copy types to packages/types first
2. Update imports one module at a time
3. Remove duplicates after all imports updated
4. Run full test suite after each step

## Related Files

- `/packages/types/src/` - Destination for public types
- `/packages/core/src/code_graph.ts` - Source of many types
- `/packages/core/src/graph_queries.ts` - Query result types
- `/packages/core/src/index.ts` - Public API exports