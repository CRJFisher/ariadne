# Task 11.109: Implement On-Demand Scope-Aware Symbol Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 3-4 weeks
**Parent:** epic-11
**Dependencies:** task-epic-11.105 (Type preprocessing)

## Objective

Transform `resolve_references` using a **resolver function index with on-demand resolution**. Build a lightweight index of resolver functions for each scope, resolve symbols only when referenced, and cache results for performance.

## Core Architecture Insight

Instead of pre-computing all resolutions upfront:

1. **Build lightweight resolver index**: `scope_id → name → resolver_function()`
2. **Resolve on-demand**: Only when we encounter a reference
3. **Cache results**: Store resolved `(scope_id, name) → symbol_id`

```typescript
// Build resolver index (cheap - just closures, including lazy import resolvers)
const resolver_index = build_scope_resolver_index(indices);

// Resolve when needed (on-demand)
const reference = find_call("helper.process()");
const symbol_id = resolve(
  reference.name,
  reference.scope_id,
  resolver_index,
  cache
);
```

## Why This Architecture

### 1. No Wasted Work

```
Pre-compute approach:
  1000 scopes × 50 symbols = 50,000 resolutions upfront
  But only 5,000 symbols are actually referenced!
  Wasted: 45,000 resolutions (90% waste)

On-demand approach:
  1000 scopes × 50 resolver functions = 50,000 closures (cheap!)
  Resolve only the 5,000 referenced symbols
  Saved: 90% of resolution work
```

### 2. Memory Efficient

```typescript
// Resolver function (tiny closure)
() => find_local_definition("helper", scope_id); // ~100 bytes

// vs pre-computed symbol_id
("function:src/utils.ts:10:0:20:1::helper"); // Already resolved
```

### 3. Cache Is Essential

```typescript
// First reference: cache miss → resolve → store
resolve("helper", scope); // Calls resolver(), caches result

// Second reference: cache hit → return immediately
resolve("helper", scope); // O(1) cache lookup
```

## Architecture Overview

```
resolve_references/
├── core/
│   ├── scope_resolver_index.ts       # Build resolver function index
│   ├── scope_resolver_index.test.ts  # Tests
│   ├── resolution_cache.ts           # Cache: (scope, name) → symbol_id
│   └── resolution_cache.test.ts      # Tests
├── import_resolution/
│   ├── import_resolver.ts            # Cross-file connections
│   └── import_resolver.test.ts       # Tests
├── type_resolution/
│   ├── type_context.ts               # Type tracking
│   └── type_context.test.ts          # Tests
└── call_resolution/
    ├── function_resolver.ts          # Resolve function calls
    ├── function_resolver.test.ts     # Tests
    ├── method_resolver.ts            # Resolve method calls
    ├── method_resolver.test.ts       # Tests
    ├── constructor_resolver.ts       # Resolve constructor calls
    └── constructor_resolver.test.ts  # Tests
```

## Key Components

### 1. Resolver Function Type

```typescript
/**
 * Resolver function - returns symbol_id when called
 * Captures resolution logic in closure
 */
type SymbolResolver = () => SymbolId | null

// Examples:
const local_def_resolver: SymbolResolver = () =>
  find_in_definitions("helper", scope_id)

const import_resolver: SymbolResolver = () =>
  imported_symbols.get("helper")

const parent_resolver: SymbolResolver = () =>
  parent_resolvers.get("helper")?.()?  // Chain to parent
```

### 2. Scope Resolver Index

```typescript
/**
 * Map of resolver functions per scope
 * Built once, lightweight (just closures)
 */
interface ScopeResolverIndex {
  // Get resolver function for a name in a scope
  get_resolver(scope_id: ScopeId, name: SymbolName): SymbolResolver | undefined;

  // Get all resolver functions for a scope (debugging)
  get_all_resolvers(scope_id: ScopeId): Map<SymbolName, SymbolResolver>;

  // Resolve with caching
  resolve(
    scope_id: ScopeId,
    name: SymbolName,
    cache: ResolutionCache
  ): SymbolId | null;
}
```

### 3. Resolution Cache

```typescript
/**
 * Stores resolved (scope, name) → symbol_id mappings
 * Essential for performance with on-demand resolution
 */
interface ResolutionCache {
  // Get cached resolution
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined;

  // Store resolution result
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void;

  // Invalidate file (for incremental analysis)
  invalidate_file(file_path: FilePath): void;

  // Clear all
  clear(): void;
}

// Phase 1: In-memory cache
class InMemoryCache implements ResolutionCache {
  private cache = new Map<string, SymbolId>();

  private key(scope: ScopeId, name: SymbolName): string {
    return `${scope}::${name}`;
  }

  get(scope: ScopeId, name: SymbolName) {
    return this.cache.get(this.key(scope, name));
  }

  set(scope: ScopeId, name: SymbolName, id: SymbolId) {
    this.cache.set(this.key(scope, name), id);
  }

  invalidate_file(file: FilePath) {
    for (const key of this.cache.keys()) {
      if (extract_file_from_key(key) === file) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Core Algorithm

### Build Resolver Index (Lightweight)

```typescript
function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportMap
): ScopeResolverIndex {
  const scope_resolvers = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();

  for (const [file_path, index] of indices) {
    build_resolvers_recursive(
      index.root_scope_id,
      new Map(), // Empty parent resolvers
      index,
      file_path,
      imports,
      scope_resolvers
    );
  }

  return create_resolver_index(scope_resolvers);
}

function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: Map<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  imports: ImportMap,
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
) {
  const resolvers = new Map<SymbolName, SymbolResolver>();

  // Step 1: Inherit parent resolvers (just copy references - O(1))
  // More local symbol-names will override these parent resolvers
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

  // Step 3: Add local definition resolvers (OVERRIDE parent/imports)
  // This is where shadowing happens naturally!
  const local_defs = find_local_definitions(scope_id, index);

  for (const [name, symbol_id] of local_defs) {
    // Closure captures the local symbol_id
    resolvers.set(name, () => symbol_id);
  }

  // Store this scope's resolvers
  scope_resolvers.set(scope_id, resolvers);

  // Step 4: Recurse to children with OUR resolvers as parent
  const scope = index.scopes.get(scope_id)!;
  for (const child_id of scope.child_ids) {
    const child = index.scopes.get(child_id);
    if (child) {
      build_resolvers_recursive(
        child_id,
        resolvers, // Pass our resolvers down
        index,
        file_path,
        imports,
        scope_resolvers
      );
    }
  }
}
```

### Resolve On-Demand with Caching

```typescript
function create_resolver_index(
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
): ScopeResolverIndex {
  return {
    get_resolver(scope_id: ScopeId, name: SymbolName) {
      return scope_resolvers.get(scope_id)?.get(name);
    },

    get_all_resolvers(scope_id: ScopeId) {
      return scope_resolvers.get(scope_id) || new Map();
    },

    resolve(
      scope_id: ScopeId,
      name: SymbolName,
      cache: ResolutionCache
    ): SymbolId | null {
      // Check cache first (O(1))
      const cached = cache.get(scope_id, name);
      if (cached !== undefined) return cached;

      // Get resolver function
      const resolver = scope_resolvers.get(scope_id)?.get(name);
      if (!resolver) return null;

      // Call resolver ON-DEMAND (only now!)
      const symbol_id = resolver();

      // Store in cache for next time
      if (symbol_id) {
        cache.set(scope_id, name, symbol_id);
      }

      return symbol_id;
    },
  };
}
```

## Shadowing Example

```typescript
// File structure:
import { helper } from './utils'  // Imports helper

function main() {
  helper()  // Should resolve to imported helper

  function inner() {
    function helper() { }  // Local definition
    helper()  // Should resolve to LOCAL helper (shadows import)
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

// Resolution:
resolve("helper", main_scope, cache)
  → cache miss
  → resolver = main_scope.resolvers.get("helper")
  → resolver() → utils#helper
  → cache.set(main_scope, "helper", utils#helper)

resolve("helper", inner_scope, cache)
  → cache miss
  → resolver = inner_scope.resolvers.get("helper")
  → resolver() → app#helper_local  // Different result!
  → cache.set(inner_scope, "helper", app#helper_local)
```

## Sub-Tasks

### Foundation (Week 1-2)

- **11.109.1** - Implement Scope Resolver Index + Resolution Cache (combined)
- **11.109.2** - Implement Import Resolution

### Type System (Week 2)

- **11.109.3** - Implement Type Context (integrates with 11.105)

### Call Resolution (Week 3)

- **11.109.4** - Implement Function Call Resolution
- **11.109.5** - Implement Method Call Resolution
- **11.109.6** - Implement Constructor Call Resolution

### Integration (Week 4)

- **11.109.7** - Main Orchestration & Pipeline
- **11.109.8** - Comprehensive Testing
- **11.109.9** - Cleanup & Documentation

### Future Enhancements

- **11.109.10** - Implement Persistent Cache (SQLite)

## Key Benefits

### 1. Performance

- **Only resolve what's referenced**: 90% reduction in resolution work
- **Lightweight index**: Resolver functions are tiny closures
- **O(1) cached lookups**: Repeated references are instant
- **Fast index build**: Just creating closures, no actual resolution

### 2. Memory Efficiency

- Resolver functions: ~100 bytes each
- Only cache actual resolutions performed
- No storage of unused resolutions

### 3. Correctness

- **Shadowing built-in**: Local resolvers override parent naturally
- **Lexical scoping**: Parent resolvers flow to children
- **Import visibility**: Only at module scope

### 4. Scalability

- **Incremental invalidation**: Cache can invalidate per-file
- **Persistent cache**: SQLite cache survives restarts
- **IDE-ready**: Sub-millisecond cached lookups

## Integration with Pipeline

```typescript
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ResolvedSymbols {
  // Phase 1: Resolve import->export connections
  const imports = resolve_imports(indices);

  // Phase 2: Build resolver index (lightweight!)
  const resolver_index = build_scope_resolver_index(indices, imports);

  // Phase 3: Create resolution cache
  const cache = new InMemoryCache();

  // Phase 4: Build type context (uses resolver_index for type name resolution)
  const type_context = build_type_context(indices, resolver_index, cache);

  // Phase 5: Resolve calls ON-DEMAND
  // Each resolver only resolves symbols it actually encounters
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
```

## Cache Evolution

### Phase 1: In-Memory (Tasks 11.109.1-9)

```typescript
const cache = new InMemoryCache();
// Rebuilt each session
// Perfect for batch analysis
```

### Phase 2: Persistent SQLite (Task 11.109.10)

```typescript
const cache = new SQLiteCache("project.cache.db");
// Survives restarts
// Invalidation based on file timestamps
// Perfect for CLI tools with repeated runs
```

### Phase 3: Redis/Shared (Future)

```typescript
const cache = new RedisCache();
// Shared across processes
// Perfect for IDE language servers
```

## Success Criteria

### Functional

- All name resolution uses resolver index
- Only referenced symbols are resolved
- Cache hit rate > 80% for repeated analyses
- Local definitions shadow imports correctly

### Architecture

- Resolver index is lightweight (< 5MB for 1000 scopes)
- Cache interface is clean and extensible
- On-demand resolution is the single approach

### Performance

- Index build: < 50ms for 1000 scopes
- First resolution: < 1ms per symbol
- Cached resolution: < 0.01ms per symbol
- Total for typical project: < 200ms

### Quality

- 95%+ test coverage
- Clear documentation
- Production-ready

## Integration with Task 11.105

Task 11.105 preprocesses type information in `SemanticIndex`. TypeContext will use the resolver index to resolve type names on-demand (same pattern).

## Dependencies

- **Requires:** SemanticIndex with complete scope trees (✓ available)
- **Requires:** All definitions have scope_id (✓ available)
- **Requires:** All references have scope_id (✓ available)
- **Integrates with:** Task 11.105 type preprocessing

## Implementation Timeline

- **Week 1-2:** Foundation (resolver index, cache, imports)
- **Week 2:** Type system
- **Week 3:** Call resolution
- **Week 4:** Integration and testing

## References

- Current implementation: `packages/core/src/resolve_references/`
- SemanticIndex API: `packages/core/src/index_single_file/semantic_index.ts`
- Scope types: `packages/types/src/scopes.ts`
