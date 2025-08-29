---
id: task-epic-11.62.1
title: Update All Function Signatures to Accept Dependencies
status: To Do
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

- [ ] Update `track_types()` signature:

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

- [ ] Update `find_method_calls()` signature:

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

- [ ] Update `find_constructor_calls()` signature:

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

- [ ] Update `resolve_symbols()` signature:

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

- [ ] Update `propagate_types()` signature:

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

- [ ] Update `analyze_call_chains()` signature:

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

- [ ] All existing tests still pass (backward compatibility)
- [ ] TypeScript compilation succeeds with new signatures
- [ ] Mock objects can be created for new parameters
- [ ] Integration points are type-safe

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

- [ ] All signatures updated with optional parameters
- [ ] TypeScript compilation successful
- [ ] All existing tests pass
- [ ] New parameters documented with JSDoc
- [ ] Dependencies between layers are explicit

## Notes

- This is a non-breaking change if done correctly with optional parameters
- Sets the foundation for all subsequent integration work
- Once complete, implementation can proceed in parallel
- Consider using a feature flag for gradual rollout
