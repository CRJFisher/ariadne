# Sub-task 139.4: Add Scope-Based Definition Queries to DefinitionRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: Critical (Gates Phase C)
**Complexity**: High
**Estimated Effort**: 2-3 days

## Overview

Enhance DefinitionRegistry to support querying definitions by scope, enabling `build_scope_resolver_index()` to migrate away from direct SemanticIndex access.

**Why critical?**
- 🔒 **Gates** sub-tasks 139.5, 139.6, 139.7 (entire Phase C)
- 🎯 **Core bottleneck**: Scope-based queries are used heavily
- 🧠 **Complex design decision**: Caching vs on-demand computation
- 🔄 **Iterative negotiation required**: API will emerge from client needs

## Current Problem

### Client Need: find_local_definitions()
**File**: `scope_resolver_index/scope_resolver_index.ts:273`

```typescript
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): ReadonlyMap<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Scans ALL functions in file
  for (const [func_id, func_def] of index.functions) {
    if (func_def.defining_scope_id === scope_id) {  // ← O(n) filter!
      defs.set(func_def.name, func_id);
    }
  }

  // Repeat for variables, classes, interfaces, enums, namespaces, types...
  // This is very inefficient - O(n * m) where n=scopes, m=definitions
}
```

**Performance**: Called for EVERY scope in EVERY file during index build!

### Client Need: extract_import_specs()
**File**: `import_resolution/import_resolver.ts:47`

```typescript
export function extract_import_specs(...): ImportSpec[] {
  // Uses efficient pre-built index
  const imports = index.scope_to_definitions
    .get(scope_id)
    ?.get("import") || [];  // ← O(1) lookup!

  // But this data structure doesn't exist in DefinitionRegistry yet
}
```

**Performance**: O(1) lookup - much better!

## Design Decision: Caching Strategy

### Option A: Lazy Cache (Recommended)
**Build scope→definitions index on first query, cache per file**

```typescript
class DefinitionRegistry {
  private by_file: Map<FilePath, AnyDefinition[]>
  private scope_cache: Map<FilePath, Map<ScopeId, AnyDefinition[]>> = new Map()  // ← NEW

  get_scope_definitions(scope_id: ScopeId, file_id: FilePath): AnyDefinition[] {
    // Check cache first
    let file_cache = this.scope_cache.get(file_id);
    if (!file_cache) {
      // Build cache for this file on first access
      file_cache = this.build_scope_cache(file_id);
      this.scope_cache.set(file_id, file_cache);
    }

    return file_cache.get(scope_id) || [];
  }

  private build_scope_cache(file_id: FilePath): Map<ScopeId, AnyDefinition[]> {
    const cache = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();
    const defs = this.by_file.get(file_id) || [];

    for (const def of defs) {
      if (!def.defining_scope_id) continue;

      if (!cache.has(def.defining_scope_id)) {
        cache.set(def.defining_scope_id, new Map());
      }

      const scope_defs = cache.get(def.defining_scope_id)!;
      if (!scope_defs.has(def.kind)) {
        scope_defs.set(def.kind, []);
      }

      scope_defs.get(def.kind)!.push(def);
    }

    return cache;
  }

  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    this.by_file.set(file_id, definitions);
    // Invalidate cache for this file
    this.scope_cache.delete(file_id);  // ← Rebuild on next query
  }
}
```

**Pros**:
- ✅ O(1) query after first access
- ✅ Only builds cache for accessed files
- ✅ Memory efficient (cache invalidated on update)
- ✅ Matches SemanticIndex performance

**Cons**:
- ❌ First query per file is O(n) (acceptable - happens once)
- ❌ Slightly more complex code

---

### Option B: Eager Cache
**Build scope→definitions index immediately on update_file()**

```typescript
class DefinitionRegistry {
  private by_file: Map<FilePath, AnyDefinition[]>
  private scope_index: Map<FilePath, Map<ScopeId, AnyDefinition[]>> = new Map()  // ← Always populated

  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    this.by_file.set(file_id, definitions);

    // Rebuild scope index immediately
    this.scope_index.set(file_id, this.build_scope_cache(file_id));
  }

  get_scope_definitions(scope_id: ScopeId, file_id: FilePath): AnyDefinition[] {
    return this.scope_index.get(file_id)?.get(scope_id) || [];
  }
}
```

**Pros**:
- ✅ Very simple query code
- ✅ Consistent O(1) queries
- ✅ No lazy complexity

**Cons**:
- ❌ Builds cache even if never queried
- ❌ O(n) on every update (may slow down incremental updates)
- ❌ More memory usage (cache always present)

---

### Option C: No Cache (On-Demand Filtering)
**Filter definitions on every query**

```typescript
class DefinitionRegistry {
  private by_file: Map<FilePath, AnyDefinition[]>

  get_scope_definitions(scope_id: ScopeId, file_id: FilePath): AnyDefinition[] {
    const all_defs = this.by_file.get(file_id) || [];
    return all_defs.filter(def => def.defining_scope_id === scope_id);  // ← O(n) every time!
  }
}
```

**Pros**:
- ✅ Simplest implementation
- ✅ Zero memory overhead
- ✅ Always fresh data

**Cons**:
- ❌ O(n) on EVERY query (unacceptable for hot path)
- ❌ Much slower than current SemanticIndex approach

---

## Recommended: Option A (Lazy Cache)

**Rationale**:
1. Matches SemanticIndex performance characteristics
2. Memory efficient (cache only built if needed)
3. Fast queries after warm-up
4. Simple invalidation on update

**Negotiation**: Try this first, measure performance, adjust if needed.

## API Design

### Core Method
```typescript
/**
 * Get all definitions in a specific scope within a file.
 *
 * This method is optimized for repeated queries:
 * - First call for a file builds a scope→definitions cache
 * - Subsequent calls are O(1) lookups
 * - Cache is invalidated on update_file()
 *
 * @param scope_id - The scope to query
 * @param file_id - The file containing the scope
 * @param kind - Optional filter by SymbolKind (e.g., only "import" definitions)
 * @returns Array of definitions in the scope (empty if scope not found)
 *
 * @example
 * ```typescript
 * // Get all definitions in a function scope
 * const defs = registry.get_scope_definitions(
 *   "scope:app.ts:main:10:0" as ScopeId,
 *   "app.ts" as FilePath
 * );
 *
 * // Get only imports in module scope
 * const imports = registry.get_scope_definitions(
 *   "scope:app.ts:module" as ScopeId,
 *   "app.ts" as FilePath,
 *   "import"
 * );
 * ```
 */
get_scope_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  kind?: SymbolKind
): AnyDefinition[]
```

### Helper Methods (If Needed)
```typescript
/**
 * Check if scope cache exists for a file.
 * Useful for debugging/testing.
 */
has_scope_cache(file_id: FilePath): boolean

/**
 * Force rebuild of scope cache for a file.
 * Normally automatic, but useful for testing.
 */
rebuild_scope_cache(file_id: FilePath): void

/**
 * Get cache statistics for monitoring.
 */
get_cache_stats(): {
  files_with_cache: number
  total_cached_scopes: number
  memory_estimate_bytes: number
}
```

## Implementation Plan

### Phase 1: Add Lazy Cache Infrastructure (Day 1)
**Duration**: 4-6 hours

**Step 1.1**: Add cache storage
```typescript
class DefinitionRegistry {
  private by_file: Map<FilePath, AnyDefinition[]> = new Map()

  // NEW: Scope cache structure
  // Map<FilePath, Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>>
  private scope_cache: Map<FilePath, Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>> = new Map()
}
```

**Step 1.2**: Implement cache builder
```typescript
private build_scope_cache(file_id: FilePath): Map<ScopeId, Map<SymbolKind, AnyDefinition[]>> {
  const cache = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();
  const defs = this.by_file.get(file_id) || [];

  for (const def of defs) {
    // Skip definitions without scope (shouldn't happen, but be defensive)
    if (!def.defining_scope_id) continue;

    // Get or create scope entry
    if (!cache.has(def.defining_scope_id)) {
      cache.set(def.defining_scope_id, new Map());
    }

    const scope_map = cache.get(def.defining_scope_id)!;

    // Get or create kind array
    if (!scope_map.has(def.kind)) {
      scope_map.set(def.kind, []);
    }

    scope_map.get(def.kind)!.push(def);
  }

  return cache;
}
```

**Step 1.3**: Update cache invalidation
```typescript
update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
  this.by_file.set(file_id, definitions);

  // Invalidate scope cache for this file
  this.scope_cache.delete(file_id);
}

remove_file(file_id: FilePath): void {
  this.by_file.delete(file_id);

  // Invalidate scope cache
  this.scope_cache.delete(file_id);
}
```

**Test**: Cache invalidates correctly on updates

---

### Phase 2: Implement Query Methods (Day 1-2)
**Duration**: 4-6 hours

**Step 2.1**: Implement get_scope_definitions (no kind filter)
```typescript
get_scope_definitions(
  scope_id: ScopeId,
  file_id: FilePath
): AnyDefinition[] {
  // Get or build cache
  let file_cache = this.scope_cache.get(file_id);
  if (!file_cache) {
    file_cache = this.build_scope_cache(file_id);
    this.scope_cache.set(file_id, file_cache);
  }

  // Look up scope
  const scope_defs = file_cache.get(scope_id);
  if (!scope_defs) {
    return [];  // Scope not found
  }

  // Flatten all kinds into single array
  const result: AnyDefinition[] = [];
  for (const defs of scope_defs.values()) {
    result.push(...defs);
  }

  return result;
}
```

**Step 2.2**: Add kind filter
```typescript
get_scope_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  kind?: SymbolKind
): AnyDefinition[] {
  let file_cache = this.scope_cache.get(file_id);
  if (!file_cache) {
    file_cache = this.build_scope_cache(file_id);
    this.scope_cache.set(file_id, file_cache);
  }

  const scope_defs = file_cache.get(scope_id);
  if (!scope_defs) {
    return [];
  }

  // If kind specified, return only that kind
  if (kind !== undefined) {
    return scope_defs.get(kind) || [];
  }

  // Otherwise return all kinds
  const result: AnyDefinition[] = [];
  for (const defs of scope_defs.values()) {
    result.push(...defs);
  }

  return result;
}
```

**Test**: Query returns correct definitions filtered by scope and kind

---

### Phase 3: Add Helper Methods (Day 2)
**Duration**: 2-3 hours

**Step 3.1**: Implement debugging helpers
```typescript
has_scope_cache(file_id: FilePath): boolean {
  return this.scope_cache.has(file_id);
}

rebuild_scope_cache(file_id: FilePath): void {
  const cache = this.build_scope_cache(file_id);
  this.scope_cache.set(file_id, cache);
}

get_cache_stats(): {
  files_with_cache: number
  total_cached_scopes: number
  memory_estimate_bytes: number
} {
  let total_scopes = 0;
  let memory_estimate = 0;

  for (const file_cache of this.scope_cache.values()) {
    total_scopes += file_cache.size;

    // Rough estimate: Map overhead + definition references
    memory_estimate += file_cache.size * 100;  // 100 bytes per scope entry (conservative)
  }

  return {
    files_with_cache: this.scope_cache.size,
    total_cached_scopes: total_scopes,
    memory_estimate_bytes: memory_estimate
  };
}
```

**Test**: Helpers work correctly

---

### Phase 4: Write Comprehensive Tests (Day 2-3)
**Duration**: 4-6 hours

**File**: `definition_registry.test.ts`

**Test cases**:

```typescript
describe('DefinitionRegistry - Scope Queries', () => {
  it('should return definitions in a specific scope', () => {
    const registry = new DefinitionRegistry();

    // Setup: Add file with multiple scopes
    const defs: AnyDefinition[] = [
      function_symbol('foo', 'app.ts', {...}, 'scope:app.ts:module'),
      function_symbol('bar', 'app.ts', {...}, 'scope:app.ts:main:10:0'),
      variable_symbol('x', 'app.ts', {...}, 'scope:app.ts:main:10:0'),
    ];

    registry.update_file('app.ts' as FilePath, defs);

    // Query module scope
    const module_defs = registry.get_scope_definitions(
      'scope:app.ts:module' as ScopeId,
      'app.ts' as FilePath
    );

    expect(module_defs).toHaveLength(1);
    expect(module_defs[0].name).toBe('foo');

    // Query function scope
    const func_defs = registry.get_scope_definitions(
      'scope:app.ts:main:10:0' as ScopeId,
      'app.ts' as FilePath
    );

    expect(func_defs).toHaveLength(2);
    expect(func_defs.map(d => d.name).sort()).toEqual(['bar', 'x']);
  });

  it('should filter definitions by kind', () => {
    // Similar setup with functions, variables, imports

    const imports = registry.get_scope_definitions(
      'scope:app.ts:module' as ScopeId,
      'app.ts' as FilePath,
      'import'
    );

    expect(imports.every(d => d.kind === 'import')).toBe(true);
  });

  it('should cache scope queries for performance', () => {
    const registry = new DefinitionRegistry();
    // ... setup ...

    // First query builds cache
    expect(registry.has_scope_cache('app.ts' as FilePath)).toBe(false);
    registry.get_scope_definitions('scope:app.ts:module' as ScopeId, 'app.ts' as FilePath);
    expect(registry.has_scope_cache('app.ts' as FilePath)).toBe(true);

    // Second query uses cache (can verify with performance test)
  });

  it('should invalidate cache on update_file', () => {
    const registry = new DefinitionRegistry();
    // ... setup and query to build cache ...

    expect(registry.has_scope_cache('app.ts' as FilePath)).toBe(true);

    // Update file
    registry.update_file('app.ts' as FilePath, []);

    // Cache should be invalidated
    expect(registry.has_scope_cache('app.ts' as FilePath)).toBe(false);
  });

  it('should return empty array for unknown scope', () => {
    const registry = new DefinitionRegistry();
    // ... setup ...

    const defs = registry.get_scope_definitions(
      'scope:app.ts:nonexistent' as ScopeId,
      'app.ts' as FilePath
    );

    expect(defs).toEqual([]);
  });

  it('should handle files with no definitions', () => {
    const registry = new DefinitionRegistry();
    registry.update_file('empty.ts' as FilePath, []);

    const defs = registry.get_scope_definitions(
      'scope:empty.ts:module' as ScopeId,
      'empty.ts' as FilePath
    );

    expect(defs).toEqual([]);
  });

  it('should handle definitions without defining_scope_id gracefully', () => {
    // Edge case: malformed definition
    const registry = new DefinitionRegistry();
    const def_without_scope = {
      ...function_symbol('foo', 'app.ts', {...}),
      defining_scope_id: undefined  // Missing!
    };

    registry.update_file('app.ts' as FilePath, [def_without_scope] as any);

    // Should not crash, just skip it
    const defs = registry.get_scope_definitions(
      'scope:app.ts:module' as ScopeId,
      'app.ts' as FilePath
    );

    expect(defs).toEqual([]);
  });
});

describe('DefinitionRegistry - Performance', () => {
  it('should handle large files efficiently', () => {
    const registry = new DefinitionRegistry();

    // Create file with 1000 scopes, 10 defs each = 10,000 definitions
    const defs: AnyDefinition[] = [];
    for (let i = 0; i < 1000; i++) {
      const scope_id = `scope:app.ts:func${i}:${i}:0` as ScopeId;
      for (let j = 0; j < 10; j++) {
        defs.push(variable_symbol(`var${i}_${j}`, 'app.ts', {...}, scope_id));
      }
    }

    registry.update_file('app.ts' as FilePath, defs);

    // First query (builds cache)
    const start1 = performance.now();
    const result1 = registry.get_scope_definitions(
      'scope:app.ts:func500:500:0' as ScopeId,
      'app.ts' as FilePath
    );
    const time1 = performance.now() - start1;

    expect(result1).toHaveLength(10);

    // Second query (uses cache - should be much faster)
    const start2 = performance.now();
    const result2 = registry.get_scope_definitions(
      'scope:app.ts:func500:500:0' as ScopeId,
      'app.ts' as FilePath
    );
    const time2 = performance.now() - start2;

    expect(result2).toHaveLength(10);
    expect(time2).toBeLessThan(time1 / 10);  // Cache should be 10x+ faster
  });
});
```

---

### Phase 5: Documentation (Day 3)
**Duration**: 1-2 hours

**Update JSDoc** in `definition_registry.ts`
**Add section to README** about scope-based queries
**Document caching behavior** for future maintainers

## Testing Strategy

### Unit Tests
- ✅ Correct definitions returned for scope
- ✅ Kind filtering works
- ✅ Cache builds correctly
- ✅ Cache invalidates on update
- ✅ Empty/missing scopes handled gracefully
- ✅ Edge cases (malformed data)

### Performance Tests
- ✅ First query acceptable speed (< 10ms for 10k definitions)
- ✅ Cached queries very fast (< 1ms)
- ✅ Memory usage reasonable (< 1MB per 1000 scopes)

### Integration Tests (In 139.5, 139.6)
- Will be tested when clients use the new API

## Acceptance Criteria

- [ ] `get_scope_definitions()` method implemented with lazy caching
- [ ] Cache invalidation works correctly on `update_file()` and `remove_file()`
- [ ] Optional `kind` parameter filters definitions correctly
- [ ] Helper methods implemented (has_scope_cache, rebuild_scope_cache, get_cache_stats)
- [ ] All unit tests passing (>95% coverage)
- [ ] Performance tests show acceptable speed
- [ ] JSDoc complete and accurate
- [ ] README section documenting scope queries

## Success Metrics

✅ Queries are O(1) after cache build
✅ Memory overhead < 20% of definition storage
✅ Zero regressions in existing DefinitionRegistry tests
✅ API is clean and intuitive for clients

## Negotiation Points for Discussion

### 1. Cache Structure
**Current proposal**: `Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>`

**Alternative**: `Map<ScopeId, AnyDefinition[]>` (simpler, but kind filter slower)

**Decision needed**: Is kind filtering important enough for the complexity?

### 2. Cache Lifetime
**Current proposal**: Lazy build, invalidate on update

**Alternative**: TTL-based expiration?

**Decision**: Stick with invalidation-based for simplicity

### 3. API Naming
**Current proposal**: `get_scope_definitions(scope_id, file_id, kind?)`

**Alternatives**:
- `query_scope(scope_id, file_id, filters?: { kind? })`
- `find_definitions({ scope_id, file_id, kind? })`

**Decision**: Current naming is clear and consistent with existing API

## Dependencies

**Prerequisites**:
- task-epic-11.138.8 (DefinitionRegistry exists)
- task-epic-11.138.9 (registries passed to resolve_symbols)

**Enables**:
- 139.5 (migrate find_local_definitions)
- 139.6 (migrate extract_import_specs)
- 139.7 (migrate build_scope_resolver_index)

## Risks

### Risk: Performance Regression
**Mitigation**: Performance tests in test suite, can optimize cache structure if needed

### Risk: Memory Bloat
**Mitigation**: Cache statistics monitoring, can add cache eviction if needed

### Risk: Cache Consistency Bugs
**Mitigation**: Comprehensive tests for invalidation, defensive programming

## Future Enhancements

After this sub-task, consider:
- [ ] Metrics for cache hit rate
- [ ] Configurable cache size limits
- [ ] Async cache warming for large projects
- [ ] Query optimization for common patterns
