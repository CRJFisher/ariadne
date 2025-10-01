# Task 11.109.7: Main Orchestration and Integration

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 days
**Parent:** task-epic-11.109
**Dependencies:**
- task-epic-11.109.1 (ScopeResolverIndex + Cache)
- task-epic-11.109.2 (ImportResolver)
- task-epic-11.109.3 (TypeContext)
- task-epic-11.109.4 (FunctionResolver)
- task-epic-11.109.5 (MethodResolver)
- task-epic-11.109.6 (ConstructorResolver)

## Objective

Integrate all resolution components into a unified pipeline in `symbol_resolution.ts`. This is the main entry point that orchestrates the entire scope-aware resolution process.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
├── symbol_resolution.ts     # Main orchestration (update)
└── index.ts                 # Public API exports
```

### Main Pipeline

```typescript
/**
 * Symbol Resolution - On-demand scope-aware unified pipeline
 *
 * Architecture:
 * 1. Build import map (cross-file connections)
 * 2. Build scope resolver index (resolver functions per scope)
 * 3. Create resolution cache (for on-demand lookups)
 * 4. Build type context (for method resolution)
 * 5. Resolve all call types using resolver index + cache
 * 6. Combine results
 */

import type { FilePath, ResolvedSymbols } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";

import { resolve_imports } from "./import_resolution/import_resolver";
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

  // Phase 1: Resolve import->export connections
  // Creates per-file map: local_name -> source_symbol_id
  const imports = resolve_imports(indices);

  // Phase 2: Build scope resolver index (lightweight)
  // Creates resolver functions: scope_id -> name -> resolver()
  const resolver_index = build_scope_resolver_index(indices, imports);

  // Phase 3: Create resolution cache
  // Stores on-demand resolutions: (scope_id, name) -> symbol_id
  const cache = create_resolution_cache();

  // Phase 4: Build type context
  // Tracks variable types and type members (uses resolver_index + cache)
  const type_context = build_type_context(indices, resolver_index, cache);

  // Phase 5: Resolve all call types (on-demand with caching)
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

  // Phase 6: Combine results
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
export type { ImportMap } from "./import_resolution/import_resolver";
export type { TypeContext } from "./type_resolution/type_context";
export type {
  FunctionCallMap,
} from "./call_resolution/function_resolver";
export type {
  MethodCallMap,
} from "./call_resolution/method_resolver";
export type {
  ConstructorCallMap,
} from "./call_resolution/constructor_resolver";
```

## Pipeline Flow Diagram

```
SemanticIndex (per file)
         ↓
   ┌─────────────────────────────────────────┐
   │ Phase 1: Import Resolution              │
   │ - resolve_imports()                     │
   │ - Cross-file symbol connections         │
   └────────────┬────────────────────────────┘
                ↓
         ImportMap (per file)
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 2: Build Resolver Index           │
   │ - build_scope_resolver_index()          │
   │ - Creates resolver functions per scope  │
   │ - Lightweight: just closures (~100B)    │
   └────────────┬────────────────────────────┘
                ↓
          ScopeResolverIndex
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 3: Create Cache                   │
   │ - create_resolution_cache()             │
   │ - Stores (scope_id, name) → symbol_id   │
   └────────────┬────────────────────────────┘
                ↓
           ResolutionCache
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 4: Type Context                   │
   │ - build_type_context()                  │
   │ - Type tracking and member lookup       │
   │ - Uses resolver_index + cache           │
   └────────────┬────────────────────────────┘
                ↓
           TypeContext
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 5: Call Resolution (On-Demand)    │
   │ - resolve_function_calls()              │
   │ - resolve_method_calls()                │
   │ - resolve_constructor_calls()           │
   │ - Each uses resolver_index + cache      │
   └────────────┬────────────────────────────┘
                ↓
    Function/Method/Constructor Maps
                ↓
   ┌─────────────────────────────────────────┐
   │ Phase 6: Combine Results                │
   │ - combine_results()                     │
   │ - Build ResolvedSymbols output          │
   └────────────┬────────────────────────────┘
                ↓
         ResolvedSymbols
```

## Integration Tests

### Test Suite: `symbol_resolution.integration.test.ts`

Test complete resolution pipeline:

#### Cross-Module Resolution
1. **Import + function call**
   ```typescript
   // utils.ts
   export function helper() {}

   // main.ts
   import { helper } from './utils';
   helper();  // Should resolve across files
   ```

2. **Import + method call**
   ```typescript
   // types.ts
   export class User {
     getName() {}
   }

   // main.ts
   import { User } from './types';
   const user = new User();
   user.getName();  // Should resolve across files
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
   const user = new User();  // Constructor resolution
   user.getName();           // Method resolution using type
   ```

7. **Factory → type → method**
   ```typescript
   function createUser(): User { return new User(); }
   const user = createUser();  // Return type tracking
   user.getName();             // Method resolution using type
   ```

#### Language Parity
8. **JavaScript** - All features work
9. **TypeScript** - All features work
10. **Python** - All features work
11. **Rust** - All features work

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

Target performance:
- Small: < 10ms
- Medium: < 100ms
- Large: < 1s

### On-Demand Benefits

**Example scenario:** Large codebase with 1000 scopes, 50 symbols per scope

Pre-compute approach:
- Build: 1000 × 50 = 50,000 full resolutions upfront
- Time: ~50ms (O(scope_depth) for each)
- Memory: 50,000 symbol_id entries

On-demand approach with caching:
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

### Architecture
- ✅ Clean separation of phases
- ✅ Clear data flow
- ✅ No circular dependencies
- ✅ Extensible for future phases

### Performance
- ✅ No performance regression
- ✅ Meets target benchmarks
- ✅ Scalable to large codebases

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Good test coverage

## Error Handling

### Graceful Degradation

```typescript
// If import resolution fails, continue with empty imports
const imports = resolve_imports(indices) || new Map();

// If type context fails, continue with limited resolution
const type_context = build_type_context(indices, scope_resolver) || {
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

## Migration from Old Code

### Before (Old Implementation)
```typescript
// Ad-hoc phases, no scope awareness
const imports = resolve_imports({ indices });
const functions = resolve_function_calls(indices, imports);
const local_types = build_local_type_context(indices, imports);
const methods = resolve_methods(indices, imports, local_types);
```

### After (New Implementation)
```typescript
// On-demand scope-aware pipeline with resolver functions
const imports = resolve_imports(indices);
const resolver_index = build_scope_resolver_index(indices, imports);
const cache = create_resolution_cache();
const type_context = build_type_context(indices, resolver_index, cache);
const functions = resolve_function_calls(indices, resolver_index, cache);
const methods = resolve_method_calls(indices, resolver_index, cache, type_context);
const constructors = resolve_constructor_calls(indices, resolver_index, cache, type_context);
```

### Key Differences
- **Before:** Imports passed everywhere
- **After:** ScopeResolverIndex encapsulates imports with resolver functions
- **Before:** Type tracking ad-hoc
- **After:** TypeContext unified
- **Before:** No constructor resolution
- **After:** Explicit constructor resolution
- **Before:** Pre-compute all resolutions (90% wasted)
- **After:** On-demand resolution with caching (only resolve what's referenced)
- **Before:** O(scope_depth) per lookup
- **After:** O(1) per lookup (after first resolution)

## Dependencies

**Uses:**
- All previous tasks (11.109.1-6)

**Consumed by:**
- External packages using `resolve_symbols()`
- Task 11.109.8 (Testing)

## Next Steps

After completion:
- Task 11.109.8 validates entire system
- Task 11.109.9 removes old code
- System is production-ready
