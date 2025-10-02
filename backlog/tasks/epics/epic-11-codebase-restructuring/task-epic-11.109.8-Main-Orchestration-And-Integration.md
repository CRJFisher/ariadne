# Task 11.109.8: Main Orchestration and Integration

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 days
**Parent:** task-epic-11.109
**Dependencies:**

- task-epic-11.109.0 (File Structure)
- task-epic-11.109.1 (ScopeResolverIndex)
- task-epic-11.109.2 (ResolutionCache)
- task-epic-11.109.3 (Lazy Import Resolution)
- task-epic-11.109.4 (TypeContext)
- task-epic-11.109.5 (FunctionResolver)
- task-epic-11.109.6 (MethodResolver)
- task-epic-11.109.7 (ConstructorResolver)

## Files to Create

This task creates exactly TWO code files:

- `packages/core/src/resolve_references/symbol_resolution.ts` (main orchestration)
- `packages/core/src/resolve_references/index.ts` (public API exports)

Plus integration test file:

- `packages/core/src/resolve_references/symbol_resolution.integration.test.ts`

## Objective

Integrate all resolution components into a unified pipeline in `symbol_resolution.ts`. This is the main entry point that orchestrates the on-demand scope-aware resolution system.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
├── symbol_resolution.ts     # Main orchestration
└── index.ts                 # Public API exports
```

### Main Pipeline

```typescript
/**
 * Symbol Resolution - On-demand scope-aware unified pipeline
 *
 * Architecture:
 * 1. Build scope resolver index (creates lazy resolver functions)
 * 2. Create resolution cache (stores resolved symbol_ids)
 * 3. Build type context (uses resolver index for type names)
 * 4. Resolve all call types (on-demand with caching)
 * 5. Combine results
 */

import type { FilePath, ResolvedSymbols } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";

import { build_scope_resolver_index } from "./core/scope_resolver_index";
import { create_resolution_cache } from "./core/resolution_cache";
import { build_type_context } from "./type_resolution/type_context";
import { resolve_function_calls } from "./call_resolution/function_resolver";
import { resolve_method_calls } from "./call_resolution/method_resolver";
import { resolve_constructor_calls } from "./call_resolution/constructor_resolver";

/**
 * Main entry point for symbol resolution
 */
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ResolvedSymbols {
  // Phase 1: Build scope resolver index (lightweight)
  // Creates resolver functions: scope_id -> name -> resolver()
  // Includes lazy import resolvers that follow export chains on-demand
  const resolver_index = build_scope_resolver_index(indices);

  // Phase 2: Create resolution cache
  // Stores on-demand resolutions: (scope_id, name) -> symbol_id
  // Shared by all resolvers for consistency and performance
  const cache = create_resolution_cache();

  // Phase 3: Build type context
  // Tracks variable types and type members
  // Uses resolver_index + cache to resolve type names
  const type_context = build_type_context(indices, resolver_index, cache);

  // Phase 4: Resolve all call types (on-demand with caching)
  const function_calls = resolve_function_calls(indices, resolver_index, cache);
  const method_calls = resolve_method_calls(
    indices,
    resolver_index,
    cache,
    type_context
  );
  const constructor_calls = resolve_constructor_calls(
    indices,
    resolver_index,
    cache,
    type_context
  );

  // Phase 5: Combine results
  return combine_results(
    indices,
    function_calls,
    method_calls,
    constructor_calls
  );
}

/**
 * Combine all resolution maps into final output
 */
function combine_results(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  function_calls: Map<LocationKey, SymbolId>,
  method_calls: Map<LocationKey, SymbolId>,
  constructor_calls: Map<LocationKey, SymbolId>
): ResolvedSymbols {
  // Master map: any reference location -> resolved SymbolId
  const resolved_references = new Map<LocationKey, SymbolId>();

  // Add function calls
  for (const [loc, id] of function_calls) {
    resolved_references.set(loc, id);
  }

  // Add method calls
  for (const [loc, id] of method_calls) {
    resolved_references.set(loc, id);
  }

  // Add constructor calls
  for (const [loc, id] of constructor_calls) {
    resolved_references.set(loc, id);
  }

  // Build reverse map: SymbolId -> all locations that reference it
  const references_to_symbol = new Map<SymbolId, Location[]>();
  for (const [loc_key, symbol_id] of resolved_references) {
    const locs = references_to_symbol.get(symbol_id) || [];
    locs.push(parse_location_key(loc_key));
    references_to_symbol.set(symbol_id, locs);
  }

  // Collect all call references
  const all_call_references: CallReference[] = [];
  for (const index of indices.values()) {
    all_call_references.push(...index.references);
  }

  // Collect all callable definitions
  const callable_definitions = new Map<SymbolId, AnyDefinition>();
  for (const idx of indices.values()) {
    for (const [id, func] of idx.functions) {
      callable_definitions.set(id, func);
    }
    for (const [id, cls] of idx.classes) {
      callable_definitions.set(id, cls);
      if (cls.constructor) {
        for (const ctor of cls.constructor) {
          callable_definitions.set(ctor.symbol_id, ctor);
        }
      }
      for (const method of cls.methods) {
        callable_definitions.set(method.symbol_id, method);
      }
    }
  }

  return {
    resolved_references,
    references_to_symbol,
    references: all_call_references,
    definitions: callable_definitions,
  };
}
```

## Public API Exports

```typescript
// packages/core/src/resolve_references/index.ts

export { resolve_symbols } from "./symbol_resolution";

// Export types for external use
export type { ScopeResolverIndex } from "./core/scope_resolver_index";
export type { ResolutionCache } from "./core/resolution_cache";
export type { TypeContext } from "./type_resolution/type_context";
export type { FunctionCallMap } from "./call_resolution/function_resolver";
export type { MethodCallMap } from "./call_resolution/method_resolver";
export type { ConstructorCallMap } from "./call_resolution/constructor_resolver";
```

## Pipeline Flow Diagram

```
SemanticIndex (per file)
         ↓
   ┌─────────────────────────────────────────┐
   │ Phase 1: Build Resolver Index           │
   │ - build_scope_resolver_index()          │
   │ - Creates resolver functions per scope  │
   │ - Includes lazy import resolvers        │
   │ - Lightweight: just closures (~100B)    │
   └────────────┬────────────────────────────┘
                ↓
          ScopeResolverIndex
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 2: Create Cache                   │
   │ - create_resolution_cache()             │
   │ - Stores (scope_id, name) → symbol_id   │
   │ - Shared across all resolutions         │
   └────────────┬────────────────────────────┘
                ↓
           ResolutionCache
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 3: Type Context                   │
   │ - build_type_context()                  │
   │ - Type tracking and member lookup       │
   │ - Uses resolver_index + cache           │
   │ - Triggers type name resolutions        │
   └────────────┬────────────────────────────┘
                ↓
           TypeContext
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 4: Call Resolution (On-Demand)    │
   │ - resolve_function_calls()              │
   │ - resolve_method_calls()                │
   │ - resolve_constructor_calls()           │
   │ - Each uses resolver_index + cache      │
   │ - May trigger nested resolutions        │
   └────────────┬────────────────────────────┘
                ↓
    Function/Method/Constructor Maps
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 5: Combine Results                │
   │ - combine_results()                     │
   │ - Build ResolvedSymbols output          │
   └────────────┬────────────────────────────┘
                ↓
         ResolvedSymbols
```

## Resolution Chains

Resolution is often multi-step, with each step potentially triggering another resolution. All resolutions flow through `resolver_index.resolve(scope_id, name, cache)`.

### Chain 1: Simple Function Call

```typescript
helper()

→ resolve(scope_id, "helper", cache)
  1. Check cache: miss
  2. Get resolver function for "helper"
  3. Call resolver: () => helper_symbol_id
  4. Cache (scope_id, "helper") → helper_symbol_id
  5. Return helper_symbol_id
```

### Chain 2: Imported Function Call

```typescript
import { helper } from './utils';
helper()

→ resolve(scope_id, "helper", cache)
  1. Check cache: miss
  2. Get resolver: () => resolve_export_chain('./utils', 'helper')
  3. Call resolver (LAZY - happens now):
     - Find export in ./utils
     - May follow re-export chain (multiple hops)
     - Returns helper_symbol_id from source
  4. Cache (scope_id, "helper") → helper_symbol_id
  5. Return helper_symbol_id
```

### Chain 3: Method Call on Typed Variable

```typescript
const user: User = ...;
user.getName()

Step 1: Resolve receiver
→ resolve(scope_id, "user", cache)
  Returns user_variable_symbol_id

Step 2: Get type of receiver
→ Look up user_variable in index
→ Extract type annotation: "User"
→ resolve(user_def_scope_id, "User", cache)  ← NESTED RESOLUTION
  1. Check cache: miss
  2. Get resolver for "User"
  3. May trigger import resolution if User is imported
  4. Cache (user_def_scope_id, "User") → User_class_symbol_id
  5. Returns User_class_symbol_id

Step 3: Look up member
→ Find User class in index
→ Find "getName" method in class
→ Returns getName_method_symbol_id
```

### Chain 4: Method Call on Imported Type

```typescript
import { User } from './types';
const user: User = ...;
user.getName()

Step 1: Resolve receiver "user"
→ resolve(scope_id, "user", cache) → user_variable_symbol_id

Step 2: Resolve type name "User" (NESTED RESOLUTION WITH LAZY IMPORT)
→ resolve(user_def_scope_id, "User", cache)
  1. Check cache: miss
  2. Get resolver: () => resolve_export_chain('./types', 'User')
  3. Call resolver (follows export chain)
  4. Cache (user_def_scope_id, "User") → User_class_symbol_id
  5. Returns User_class_symbol_id

Step 3: Look up member "getName"
→ Returns getName_method_symbol_id
```

### Key Insight: Single Cache, Nested Resolutions

All resolutions use the same cache: `(scope_id, name) → symbol_id`

- Variable names: `(scope_id, var_name) → var_symbol_id`
- Type names: `(scope_id, type_name) → type_symbol_id` (same cache!)
- Imported symbols: `(scope_id, imported_name) → symbol_id` (same cache!)

Resolution chains are just nested calls to `resolve()`. Each nested call:

1. Checks the shared cache
2. Invokes resolver function if cache miss
3. Stores result in shared cache
4. Returns symbol_id

## Integration Tests

### Test Suite: `symbol_resolution.integration.test.ts`

Test complete resolution pipeline:

#### Cross-Module Resolution

1. **Import + function call**

   ```typescript
   // utils.ts
   export function helper() {}

   // main.ts
   import { helper } from "./utils";
   helper(); // Should resolve across files
   ```

2. **Import + method call**

   ```typescript
   // types.ts
   export class User {
     getName() {}
   }

   // main.ts
   import { User } from "./types";
   const user = new User();
   user.getName(); // Should resolve across files
   ```

#### Shadowing Scenarios

3. **Local shadows import**
4. **Nested scope shadowing**
5. **Type shadowing in method resolution**

#### Complete Workflows

6. **Constructor → type → method**

   ```typescript
   class User {
     getName() {}
   }
   const user = new User(); // Constructor resolution
   user.getName(); // Method resolution using type
   ```

7. **Factory → type → method**
   ```typescript
   function createUser(): User {
     return new User();
   }
   const user = createUser(); // Return type tracking
   user.getName(); // Method resolution using type
   ```

#### Resolution Chains

8. **Nested type resolution** - Type name requires import resolution
9. **Re-export chains** - Import follows multiple re-export hops
10. **Circular imports** - Handled gracefully

#### Language Parity

11. **JavaScript** - All features work
12. **TypeScript** - All features work
13. **Python** - All features work
14. **Rust** - All features work

## Performance Testing

### Benchmarks

Create benchmarks for:

1. **Small project** - 10 files, 100 functions
2. **Medium project** - 100 files, 1000 functions
3. **Large project** - 1000 files, 10000 functions

Measure:

- Total resolution time
- Time per phase
- Memory usage
- Cache hit rates

Target performance:

- Small: < 10ms
- Medium: < 100ms
- Large: < 1s

### On-Demand Benefits

**Example scenario:** Large codebase with 1000 scopes, 50 symbols per scope

Traditional (pre-compute all resolutions):

- Build: 1000 × 50 = 50,000 full resolutions upfront
- Time: ~50ms (O(scope_depth) for each)
- Memory: 50,000 symbol_id entries

On-demand with lazy imports:

- Build: 1000 × 50 = 50,000 resolver functions (~100B each = 5MB)
- First use: Only ~5,000 symbols referenced (10%)
- Resolutions: 5,000 resolver calls + ~4,000 cache hits (80% hit rate)
- Time: ~5ms for resolutions (10x faster!)
- Memory: 5,000 cache entries (10x less!)

**Cache hit rates improve over time:**

- Early phase: 50% hits
- Mid phase: 80% hits
- Late phase: 95% hits

## Success Criteria

### Functional

- ✅ All phases execute in correct order
- ✅ All resolvers receive correct inputs
- ✅ Output matches ResolvedSymbols type
- ✅ All existing tests pass
- ✅ Integration tests pass
- ✅ Resolution chains work correctly

### Architecture

- ✅ Clean separation of phases
- ✅ Clear data flow
- ✅ No circular dependencies
- ✅ Extensible for future phases
- ✅ Single shared cache

### Performance

- ✅ No performance regression
- ✅ Meets target benchmarks
- ✅ Scalable to large codebases
- ✅ Lazy imports save 90% of import work
- ✅ Cache hit rates 80%+

### Code Quality

- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Good test coverage
- ✅ Pythonic naming convention

## Error Handling

### Graceful Degradation

```typescript
// If resolver index build fails, bail out
const resolver_index = build_scope_resolver_index(indices);
if (!resolver_index) {
  throw new Error("Failed to build resolver index");
}

// If type context fails, continue with limited resolution
const type_context = build_type_context(indices, resolver_index, cache) || {
  get_symbol_type: () => null,
  get_type_member: () => null,
  get_type_members: () => new Map(),
};

// Partial results are better than no results
```

### Error Reporting

Log warnings for:

- Unresolved imports
- Unknown types
- Missing definitions
- Resolution failures

But don't throw - collect as many resolutions as possible.

## Dependencies

**Uses:**

- All previous tasks (11.109.0-7)

**Consumed by:**

- External packages using `resolve_symbols()`
- Task 11.109.9 (Comprehensive Testing)

## Next Steps

After completion:

- Task 11.109.9 validates entire system with comprehensive tests
- Task 11.109.10 removes old code and finalizes documentation
- System is production-ready
