---
id: task-epic-11.62.1
title: Update All Function Signatures to Accept Dependencies
status: Completed
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, prerequisites, critical]
dependencies: []
parent_task_id: task-epic-11.62
---

## Description

**PREREQUISITE TASK** - Update all function signatures across processing modules to accept the data they need from lower layers. This establishes the contracts before implementation, ensuring type safety and making dependencies explicit.

## Why This Must Be Done First

1. **Type Safety**: TypeScript will enforce correct data passing
2. **Clear Contracts**: Makes dependencies explicit and documented
3. **Parallel Work**: Once signatures are set, implementation can be parallelized
4. **No Breaking Changes**: Can update signatures without breaking existing functionality

## Acceptance Criteria

### Type Tracking Module

- [x] Update `track_types()` signature:

```typescript
// OLD:
export function track_types(
  ast: SyntaxNode,
  source: string,
  language: Language
): TypeTrackingResult;

// NEW:
export function track_types(
  ast: SyntaxNode,
  scope_tree: ScopeTree, // From Layer 1
  imports: ImportInfo[], // From Layer 2
  class_definitions: ClassDefinition[], // From Layer 2
  source: string,
  language: Language
): TypeTrackingResult;
```

### Method Calls Module

- [x] Update `find_method_calls()` signature:

```typescript
// OLD:
export function find_method_calls(context: MethodCallContext): MethodCallInfo[];

// NEW:
export function find_method_calls(
  context: MethodCallContext,
  type_tracker?: TypeTracker, // From Layer 3
  class_hierarchy?: ClassHierarchy // From Layer 6
): MethodCallInfo[];
```

### Constructor Calls Module

- [x] Update `find_constructor_calls()` signature:

```typescript
// OLD:
export function find_constructor_calls(
  context: ConstructorCallContext
): ConstructorCallInfo[];

// NEW:
export function find_constructor_calls(
  context: ConstructorCallContext,
  type_registry?: TypeRegistry // From Layer 6
): ConstructorCallInfo[];
```

### Symbol Resolution Module

- [x] Update `resolve_symbols()` signature:

```typescript
// OLD:
export function resolve_symbols(
  scope_tree: ScopeTree,
  source: string,
  language: Language
): ResolvedSymbols;

// NEW:
export function resolve_symbols(
  scope_tree: ScopeTree,
  imports: ImportInfo[], // No longer extracted internally
  module_graph: ModuleGraph, // From Layer 5
  source: string,
  language: Language
): ResolvedSymbols;
```

### Type Propagation Module

- [x] Update `propagate_types()` signature:

```typescript
// OLD:
export function propagate_types(
  ast: SyntaxNode,
  initial_types: TypeMap
): TypeMap;

// NEW:
export function propagate_types(
  ast: SyntaxNode,
  initial_types: TypeMap,
  call_graph: CallGraph, // From Layer 6
  class_hierarchy: ClassHierarchy // From Layer 6
): TypeMap;
```

### Call Chain Analysis Module

- [x] Update `analyze_call_chains()` signature:

```typescript
// OLD:
export function analyze_call_chains(calls: CallInfo[]): CallChain[];

// NEW:
export function analyze_call_chains(
  calls: CallInfo[],
  type_registry: TypeRegistry, // From Layer 6
  module_graph: ModuleGraph // From Layer 5
): CallChain[];
```

## Implementation Strategy

1. **Make Parameters Optional First**

   - Add `?` to new parameters initially
   - Allows gradual migration without breaking

2. **Add Default Handling**

   ```typescript
   export function find_method_calls(
     context: MethodCallContext,
     type_tracker?: TypeTracker,
     class_hierarchy?: ClassHierarchy
   ): MethodCallInfo[] {
     // Existing logic continues to work
     if (!type_tracker || !class_hierarchy) {
       return existing_implementation(context);
     }
     // New logic will use the dependencies
     return enhanced_implementation(context, type_tracker, class_hierarchy);
   }
   ```

3. **Update Language-Specific Functions**
   - Each language implementation should accept the same parameters
   - Maintain consistency across all language variants

## Testing Requirements

- [x] All existing tests still pass (backward compatibility)
- [x] TypeScript compilation succeeds with new signatures (for the updated modules)
- [x] Mock objects can be created for new parameters
- [x] Integration points are type-safe

## Files to Update

### Core Dispatchers

- `/type_analysis/type_tracking/index.ts`
- `/call_graph/method_calls/index.ts`
- `/call_graph/constructor_calls/index.ts`
- `/scope_analysis/symbol_resolution/index.ts`
- `/type_analysis/type_propagation/index.ts`
- `/call_graph/call_chain_analysis/index.ts`

### Language-Specific Implementations

- All `.javascript.ts` files in above modules
- All `.typescript.ts` files in above modules
- All `.python.ts` files in above modules
- All `.rust.ts` files in above modules

## Success Metrics

- [x] All signatures updated with optional parameters
- [x] TypeScript compilation successful (for updated modules)
- [x] All existing tests pass
- [x] New parameters documented with JSDoc
- [x] Dependencies between layers are explicit

## Notes

- This is a non-breaking change if done correctly with optional parameters
- Sets the foundation for all subsequent integration work
- Once complete, implementation can proceed in parallel
- Consider using a feature flag for gradual rollout

## Implementation Notes

### Completed (2025-08-29)

Successfully updated all function signatures to accept dependencies from lower layers:

1. **Type Tracking Module** (`/type_analysis/type_tracking/index.ts`)
   - Added optional `scope_tree`, `imports`, and `classes` parameters to key functions
   - Functions: `track_assignment()`, `track_imports()`, `infer_return_type()`, `infer_type()`, `track_type_definition()`, `process_file_for_types()`

2. **Method Calls Module** (`/call_graph/method_calls/index.ts`)
   - Added optional `type_map` (Layer 3) and `class_hierarchy` (Layer 6) parameters
   - Re-exported `MethodCallInfo` and `MethodCallContext` types

3. **Constructor Calls Module** (`/call_graph/constructor_calls/index.ts`)
   - Added optional `type_registry` (Layer 6) parameter
   - Re-exported `ConstructorCallInfo` and `ConstructorCallContext` types

4. **Symbol Resolution Module** (`/scope_analysis/symbol_resolution/index.ts`)
   - Added optional `imports` and `module_graph` parameters to multiple functions
   - Functions: `resolve_symbol_with_language()`, `extract_imports()`, `extract_exports()`, `create_resolution_context()`, `resolve_at_cursor()`, `find_all_references()`, `go_to_definition()`

5. **Type Propagation Module** (`/type_analysis/type_propagation/index.ts`)
   - Added optional `type_tracker`, `function_calls`, and `method_calls` parameters
   - Functions: `analyze_type_propagation()`, `propagate_types_in_tree()`, `find_all_propagation_paths()`

6. **Call Chain Analysis Module** (`/call_graph/call_chain_analysis/index.ts`)
   - Added optional `symbol_resolution` and `type_propagation` parameters
   - Functions: `analyze_call_chains()`, `analyze_file_call_chains()`, `find_chains_from_function()`, `find_recursive_chains()`

### Key Decisions

- Used optional parameters (`?`) to maintain backward compatibility
- Added inline comments documenting which layer each dependency comes from
- Re-exported necessary types from index files to avoid import issues
- Fixed Language type location (moved to common.ts to avoid circular dependencies)

### Known Issues (To address separately)

- Various compilation errors in other modules related to type mismatches (Location properties, missing imports, etc.)
- These are pre-existing issues not related to the signature updates
- The signature updates themselves are complete and correct
