# Task 11.109.1: Implement Scope Resolver Index

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 3-4 days
**Parent:** task-epic-11.109
**Dependencies:** task-epic-11.109.0 (File Structure)

## Objective

Implement `scope_resolver_index.ts` - builds a lightweight map of resolver functions for each scope. This is the core foundation of on-demand symbol resolution.

## Files to Create

**This task creates exactly ONE code file:**

- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.test.ts`

## Implementation

### Core Interface

```typescript
/**
 * Scope Resolver Index
 *
 * Maps each scope to its available symbol resolvers.
 * Resolvers are lazy - they only execute when a symbol is referenced.
 */
export interface ScopeResolverIndex {
  /**
   * Resolve a symbol name in a scope (with caching)
   * This encapsulates cache checking and resolver execution
   */
  resolve(
    scope_id: ScopeId,
    name: SymbolName,
    cache: ResolutionCache
  ): SymbolId | null;
}
```

### Main Build Function

```typescript
import type { FilePath, SymbolId, SymbolName, ScopeId } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { SymbolResolver, ImportSpec } from "../types";
import type { ResolutionCache } from "./resolution_cache";
import { extract_import_specs, resolve_export_chain } from "../import_resolution/lazy_import_resolver";

/**
 * Build resolver index for all scopes across all files
 */
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ScopeResolverIndex {

  const scope_resolvers = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();

  // Process each file's scope tree
  for (const [file_path, index] of indices) {
    const file_resolvers = build_resolvers_recursive(
      index.root_scope_id,
      new Map(), // Empty parent resolvers at root
      index,
      file_path,
      indices
    );

    // Merge file's resolvers into main map
    for (const [scope_id, resolvers] of file_resolvers) {
      scope_resolvers.set(scope_id, resolvers);
    }
  }

  return create_resolver_index(scope_resolvers);
}

/**
 * Recursively build resolvers for a scope and its children
 * Returns map of scope_id -> resolver map
 */
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): Map<ScopeId, Map<SymbolName, SymbolResolver>> {

  const result = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();
  const resolvers = new Map<SymbolName, SymbolResolver>();

  // Step 1: Inherit parent resolvers (copy references - cheap!)
  for (const [name, resolver] of parent_resolvers) {
    resolvers.set(name, resolver);
  }

  // Step 2: Add import resolvers for this scope (any scope level!)
  const import_specs = extract_import_specs(scope_id, index, file_path);

  for (const spec of import_specs) {
    // Closure captures import spec and resolves lazily
    resolvers.set(spec.local_name, () =>
      resolve_export_chain(spec.source_file, spec.import_name, indices)
    );
  }

  // Step 3: Add local definition resolvers (OVERRIDES parent/imports!)
  const local_defs = find_local_definitions(scope_id, index);

  for (const [name, symbol_id] of local_defs) {
    // Closure captures the local symbol_id
    // This naturally implements shadowing!
    resolvers.set(name, () => symbol_id);
  }

  // Store this scope's resolvers in result
  result.set(scope_id, resolvers);

  // Step 4: Recurse to children with OUR resolvers as parent
  const scope = index.scopes.get(scope_id)!;
  for (const child_id of scope.child_ids) {
    const child = index.scopes.get(child_id);
    if (child) {
      const child_resolvers = build_resolvers_recursive(
        child_id,
        resolvers, // Pass our resolvers down to children
        index,
        file_path,
        indices
      );

      // Merge child results into our result
      for (const [child_scope_id, child_scope_resolvers] of child_resolvers) {
        result.set(child_scope_id, child_scope_resolvers);
      }
    }
  }

  return result;
}

/**
 * Find all definitions declared directly in a scope
 */
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): Map<SymbolName, SymbolId> {

  const defs = new Map<SymbolName, SymbolId>();

  // Functions
  for (const [func_id, func_def] of index.functions) {
    if (func_def.scope_id === scope_id) {
      defs.set(func_def.name, func_id);
    }
  }

  // Variables
  for (const [var_id, var_def] of index.variables) {
    if (var_def.scope_id === scope_id) {
      defs.set(var_def.name, var_id);
    }
  }

  // Classes
  for (const [class_id, class_def] of index.classes) {
    if (class_def.scope_id === scope_id) {
      defs.set(class_def.name, class_id);
    }
  }

  // Interfaces
  for (const [iface_id, iface_def] of index.interfaces) {
    if (iface_def.scope_id === scope_id) {
      defs.set(iface_def.name, iface_id);
    }
  }

  return defs;
}

/**
 * Create ScopeResolverIndex implementation
 */
function create_resolver_index(
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
): ScopeResolverIndex {

  return {
    resolve(
      scope_id: ScopeId,
      name: SymbolName,
      cache: ResolutionCache
    ): SymbolId | null {

      // Check cache first - O(1)
      const cached = cache.get(scope_id, name);
      if (cached !== undefined) {
        return cached;
      }

      // Get resolver function
      const resolvers = scope_resolvers.get(scope_id);
      if (!resolvers) {
        return null;
      }

      const resolver = resolvers.get(name);
      if (!resolver) {
        return null;
      }

      // Call resolver ON-DEMAND (only now!)
      const symbol_id = resolver();

      // Store in cache for future lookups
      if (symbol_id !== null) {
        cache.set(scope_id, name, symbol_id);
      }

      return symbol_id;
    },
  };
}
```

## Test Coverage

### Unit Tests (`scope_resolver_index.test.ts`)

**Basic Functionality:**
1. ✅ Build index for single file with multiple scopes
2. ✅ Resolve local symbol in same scope
3. ✅ Resolve symbol from parent scope
4. ✅ Local symbol shadows parent symbol
5. ✅ Resolve imported symbol (integration with lazy_import_resolver)

**Inheritance:**
6. ✅ Child scope inherits parent resolvers
7. ✅ Grandchild scope inherits from grandparent
8. ✅ Sibling scopes don't share local definitions

**Shadowing:**
9. ✅ Local definition shadows import
10. ✅ Inner scope shadows outer scope
11. ✅ Multiple levels of shadowing

**Imports:**
12. ✅ Import resolvers added to module scope
13. ✅ Import resolvers added to function scope (Python)
14. ✅ Import resolver called lazily only when referenced

**Cache Integration:**
15. ✅ First resolution caches result
16. ✅ Second resolution uses cache (resolver not called again)
17. ✅ Different scopes cache separately

**Per-Language:**
18. ✅ JavaScript - 10 test cases
19. ✅ TypeScript - 12 test cases
20. ✅ Python - 10 test cases (including local imports)
21. ✅ Rust - 10 test cases

## Success Criteria

- ✅ Single file created: `scope_resolver_index.ts`
- ✅ All interface methods implemented
- ✅ Resolvers are closures (not pre-computed values)
- ✅ Shadowing works naturally through Map.set()
- ✅ Cache integration works correctly
- ✅ 100% line coverage
- ✅ 100% branch coverage
- ✅ All 4 languages tested
- ✅ Pythonic naming convention

## Dependencies

**Uses:**
- `../types.ts` (SymbolResolver, ImportSpec)
- `./resolution_cache.ts` (ResolutionCache interface - task 11.109.2)
- `../import_resolution/lazy_import_resolver.ts` (extract_import_specs, resolve_export_chain - task 11.109.3)
- `@ariadnejs/types` (SymbolId, SymbolName, ScopeId, FilePath)
- `../../index_single_file/semantic_index.ts` (SemanticIndex)

**Consumed by:**
- task-epic-11.109.4 (Type Context)
- task-epic-11.109.5 (Function Call Resolution)
- task-epic-11.109.6 (Method Call Resolution)
- task-epic-11.109.7 (Constructor Call Resolution)

## Next Steps

After completion:
- Task 11.109.2 creates resolution_cache.ts
- Task 11.109.3 creates lazy_import_resolver.ts
- This file will be imported by all resolvers
