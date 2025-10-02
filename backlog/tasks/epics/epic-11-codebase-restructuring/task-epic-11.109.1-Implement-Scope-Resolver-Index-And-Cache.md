# Task 11.109.1: Implement Scope Resolver Index with On-Demand Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 5-6 days
**Parent:** task-epic-11.109
**Dependencies:** None (uses existing SemanticIndex)

## Objective

Implement the **scope resolver index** - a lightweight map of resolver functions for each scope. This is the foundation of on-demand symbol resolution.

## Core Concept

Build an index of resolver functions (closures) rather than pre-computing all resolutions:

```typescript
// Build index: scope_id → name → resolver_function()
const resolver_index = build_scope_resolver_index(indices)

// Resolve on-demand when needed
const symbol_id = resolver_index.resolve(scope_id, name, cache)
```

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── scope_resolver/
    ├── scope_resolver_index.ts
    ├── scope_resolver_index.test.ts
    ├── resolution_cache.ts
    └── resolution_cache.test.ts
```

### Core Types

```typescript
/**
 * Resolver function - returns symbol_id when called
 * Captures resolution logic in closure
 */
type SymbolResolver = () => SymbolId | null

/**
 * Scope Resolver Index
 * Maps scope_id → name → resolver_function
 */
interface ScopeResolverIndex {
  /**
   * Get resolver function for a name in a scope
   */
  get_resolver(scope_id: ScopeId, name: SymbolName): SymbolResolver | undefined

  /**
   * Get all resolver functions for a scope (debugging/testing)
   */
  get_all_resolvers(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolResolver>

  /**
   * Resolve a name in a scope with caching
   * This is the main API used by call resolvers
   */
  resolve(
    scope_id: ScopeId,
    name: SymbolName,
    cache: ResolutionCache
  ): SymbolId | null
}

/**
 * Resolution Cache
 * Stores (scope_id, name) → symbol_id mappings
 */
interface ResolutionCache {
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void
  invalidate_file(file_path: FilePath): void
  clear(): void
}
```

### Main Algorithm: Build Resolver Index

```typescript
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ScopeResolverIndex {

  const scope_resolvers = new Map<ScopeId, Map<SymbolName, SymbolResolver>>()

  // Process each file's scope tree
  for (const [file_path, index] of indices) {
    build_resolvers_recursive(
      index.root_scope_id,
      new Map(), // Empty parent resolvers at root
      index,
      file_path,
      indices,
      scope_resolvers
    )
  }

  return create_resolver_index(scope_resolvers)
}

function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: Map<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
): void {

  const resolvers = new Map<SymbolName, SymbolResolver>()

  // Step 1: Inherit parent resolvers (copy references - cheap!)
  for (const [name, resolver] of parent_resolvers) {
    resolvers.set(name, resolver)
  }

  // Step 2: Add import resolvers for this scope (any scope level!)
  const import_specs = extract_import_specs(scope_id, index, file_path)

  for (const spec of import_specs) {
    // Closure captures import spec and resolves lazily
    resolvers.set(spec.local_name, () =>
      resolve_export_chain(spec.source_file, spec.import_name, indices)
    )
  }

  // Step 3: Add local definition resolvers (OVERRIDES parent/imports!)
  const local_defs = find_local_definitions(scope_id, index)

  for (const [name, symbol_id] of local_defs) {
    // Closure captures the local symbol_id
    // This naturally implements shadowing!
    resolvers.set(name, () => symbol_id)
  }

  // Store this scope's resolvers
  scope_resolvers.set(scope_id, resolvers)

  // Step 4: Recurse to children with OUR resolvers as parent
  const scope = index.scopes.get(scope_id)!
  for (const child_id of scope.child_ids) {
    const child = index.scopes.get(child_id)
    if (child) {
      build_resolvers_recursive(
        child_id,
        resolvers, // Pass our resolvers down to children
        index,
        file_path,
        indices,
        scope_resolvers
      )
    }
  }
}

/**
 * Find all definitions declared directly in a scope
 * (not inherited from parent)
 */
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): Map<SymbolName, SymbolId> {

  const local = new Map<SymbolName, SymbolId>()

  // Check all definition types
  const all_definitions = [
    ...index.functions,
    ...index.classes,
    ...index.variables,
    ...index.interfaces,
    ...index.enums,
    ...index.namespaces,
    ...index.types,
  ]

  for (const [symbol_id, def] of all_definitions) {
    if (def.scope_id === scope_id) {
      local.set(def.name, symbol_id)
    }
  }

  return local
}
```

### Create Resolver Index Interface

```typescript
function create_resolver_index(
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
): ScopeResolverIndex {

  return {
    get_resolver(scope_id: ScopeId, name: SymbolName) {
      return scope_resolvers.get(scope_id)?.get(name)
    },

    get_all_resolvers(scope_id: ScopeId) {
      return scope_resolvers.get(scope_id) || new Map()
    },

    resolve(
      scope_id: ScopeId,
      name: SymbolName,
      cache: ResolutionCache
    ): SymbolId | null {

      // Check cache first - O(1)
      const cached = cache.get(scope_id, name)
      if (cached !== undefined) return cached

      // Get resolver function
      const resolver = scope_resolvers.get(scope_id)?.get(name)
      if (!resolver) return null

      // Call resolver ON-DEMAND (only now!)
      const symbol_id = resolver()

      // Store in cache for future lookups
      if (symbol_id !== null) {
        cache.set(scope_id, name, symbol_id)
      }

      return symbol_id
    }
  }
}
```

### Resolution Cache Implementation

```typescript
/**
 * In-memory resolution cache
 * Stores (scope_id, name) → symbol_id mappings
 */
export class InMemoryResolutionCache implements ResolutionCache {
  private cache = new Map<string, SymbolId>()

  private make_key(scope: ScopeId, name: SymbolName): string {
    return `${scope}::${name}`
  }

  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined {
    return this.cache.get(this.make_key(scope_id, name))
  }

  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void {
    this.cache.set(this.make_key(scope_id, name), symbol_id)
  }

  invalidate_file(file_path: FilePath): void {
    // Remove all entries for scopes in this file
    for (const key of this.cache.keys()) {
      const scope_id = key.split('::')[0] as ScopeId
      if (extract_file_from_scope_id(scope_id) === file_path) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

function extract_file_from_scope_id(scope_id: ScopeId): FilePath {
  // Format: "type:file_path:line:column:end_line:end_column"
  const parts = scope_id.split(':')
  return parts[1] as FilePath
}
```

## Test Coverage

### Unit Tests (`scope_resolver_index.test.ts`)

**Test Build Process:**
1. ✅ Build resolver index for single file
2. ✅ Build resolver index for multiple files
3. ✅ Resolver functions inherit from parent
4. ✅ Local definitions override parent resolvers
5. ✅ Imports only added at module scope
6. ✅ Empty scopes work correctly

**Test Resolution:**
7. ✅ Resolve local definition
8. ✅ Resolve parent definition
9. ✅ Resolve import at module scope
10. ✅ Local definition shadows parent
11. ✅ Local definition shadows import
12. ✅ Not found returns null
13. ✅ Cross-file resolution

**Test Caching:**
14. ✅ Cache hit on second resolution
15. ✅ Cache miss on first resolution
16. ✅ Resolver only called once per unique (scope, name)

**Test All Languages:**
17. ✅ JavaScript - function shadowing
18. ✅ TypeScript - import shadowing
19. ✅ Python - nested function shadowing
20. ✅ Rust - use statement shadowing

### Unit Tests (`resolution_cache.test.ts`)

1. ✅ Get returns undefined for missing entry
2. ✅ Set and get roundtrip works
3. ✅ Invalidate file removes entries
4. ✅ Clear removes all entries
5. ✅ Multiple files don't interfere

## Example: Shadowing

```typescript
// Source code:
import { helper } from './utils'

function main() {
  helper()  // Should resolve to imported helper

  function inner() {
    function helper() { }  // Local definition
    helper()  // Should resolve to LOCAL helper
  }
}

// Resolver index built:
module_scope.resolvers = {
  "helper": () => utils#helper,  // Import resolver
  "main": () => app#main
}

main_scope.resolvers = {
  "helper": () => utils#helper,  // Inherited from module
  "main": () => app#main,
  "inner": () => app#inner
}

inner_scope.resolvers = {
  "helper": () => app#helper_local,  // OVERRIDES import!
  "main": () => app#main,
  "inner": () => app#inner
}

// Resolution with cache:
cache = new InMemoryResolutionCache()

resolve("helper", main_scope, cache)
  → cache.get(main_scope, "helper") → undefined (miss)
  → resolver = main_scope.resolvers.get("helper")
  → symbol_id = resolver() → utils#helper
  → cache.set(main_scope, "helper", utils#helper)
  → return utils#helper

resolve("helper", inner_scope, cache)
  → cache.get(inner_scope, "helper") → undefined (miss)
  → resolver = inner_scope.resolvers.get("helper")
  → symbol_id = resolver() → app#helper_local
  → cache.set(inner_scope, "helper", app#helper_local)
  → return app#helper_local

resolve("helper", main_scope, cache)  // Second time
  → cache.get(main_scope, "helper") → utils#helper (HIT!)
  → return utils#helper (resolver not called)
```

## Success Criteria

### Functional
- ✅ Build resolver index from SemanticIndex
- ✅ Resolver functions correctly capture symbol_ids
- ✅ Local definitions override parent resolvers
- ✅ Imports only visible at module scope
- ✅ On-demand resolution works correctly
- ✅ Cache stores and retrieves resolutions

### Testing
- ✅ 100% code coverage
- ✅ All test cases pass for all languages
- ✅ Shadowing edge cases covered
- ✅ Cache behavior validated

### Performance
- ✅ Index build < 50ms for 1000 scopes
- ✅ Resolver functions are lightweight (closures)
- ✅ First resolution < 1ms
- ✅ Cached resolution < 0.01ms

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Clear error messages
- ✅ Type-safe (no `any` types)
- ✅ Clean interfaces

## Key Insights

### Why Resolver Functions?

**Closure captures resolution logic:**
```typescript
// Local definition resolver
() => symbol_id  // Just returns the captured symbol_id

// Parent resolver
() => parent_resolvers.get(name)?.()?  // Chains to parent

// Import resolver
() => imports.get(file).get(name)  // Looks up in import map
```

**Advantages:**
- Tiny memory footprint (~100 bytes per closure)
- Only resolve when actually referenced
- Natural shadowing through map.set() override
- Lazy evaluation - no wasted work

### Cache Is Critical

Without cache:
```
10,000 references × 1ms resolver call = 10 seconds
```

With cache (80% hit rate):
```
2,000 misses × 1ms + 8,000 hits × 0.01ms = 2.08 seconds
```

**5x speedup from caching!**

## Dependencies

**Uses:**
- `SemanticIndex` with scope trees
- `ImportMap` from import resolution (11.109.3)

**Consumed by:**
- All call resolvers (11.109.5-7)
- Type context (11.109.4)

## Next Steps

After completion:
- Task 11.109.2: Split cache into separate task (or keep together?)
- Task 11.109.3: Import resolution will create ImportMap
- Tasks 11.109.5-7: Call resolvers will use this index
