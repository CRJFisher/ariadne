---
id: task-160
title: Implement multi-layer caching system for semantic indexing and resolution
status: To Do
assignee: []
created_date: '2025-11-20'
labels: [performance, architecture]
dependencies: []
---

## Overview

Add caching at strategic points in the processing pipeline to improve performance for incremental updates and session persistence. The system uses a pluggable cache provider interface, allowing users to implement custom backends (SQLite, Redis, etc.) while providing an in-memory default.

## Architecture

### Cache Layers

The pipeline has three natural cache boundaries, each with different characteristics:

```
File Content → [Parse Cache] → Tree-sitter Tree → [Semantic Index Cache] → SemanticIndex → [Resolution Cache] → Resolved Calls
     ↓                                    ↓                                        ↓
   Expensive                          Moderate                                  Moderate
   (10-50ms)                         (5-25ms)                                  (10-150ms)
```

### 1. Parse Cache

**What:** Cache tree-sitter parse trees
**Input:** File content hash
**Output:** `Parser.Tree` object
**Cost saved:** 10-50ms per file (tree-sitter parsing is expensive)
**Storage:** Cannot be serialized (native C++ objects), must be in-memory only

```typescript
interface ParseCache {
  key: (file_path: FilePath, content_hash: string, language: Language) => string
  value: Parser.Tree
  invalidation: content changes
  persistence: in-memory only (trees not serializable)
}
```

**Invalidation triggers:**
- File content changes (hash mismatch)
- Language version changes (tree-sitter grammar update)

**Implementation notes:**
- Trees contain native pointers, cannot be persisted
- Must be memory-bounded (LRU eviction)
- High hit rate for files that don't change (90%+ in typical workflow)

### 2. Semantic Index Cache

**What:** Cache semantic index results per file
**Input:** Tree-sitter tree hash (or content hash)
**Output:** `SemanticIndex` object (definitions, references, scopes)
**Cost saved:** 5-25ms per file (query execution + processing)
**Storage:** Fully serializable (plain objects), can persist across sessions

```typescript
interface SemanticIndexCache {
  key: (file_path: FilePath, content_hash: string, schema_version: string) => string
  value: SemanticIndex
  invalidation: content changes OR schema changes
  persistence: disk-persistable (JSON/MessagePack)
}
```

**Data structure (per file):**
```typescript
{
  file_path: FilePath,
  content_hash: string,
  schema_version: string,
  semantic_index: {
    scopes: Map<ScopeId, LexicalScope>,
    functions: Map<SymbolId, FunctionDefinition>,
    classes: Map<SymbolId, ClassDefinition>,
    variables: Map<SymbolId, VariableDefinition>,
    // ... other definition types
    references: SymbolReference[]
  }
}
```

**Invalidation triggers:**
- File content changes
- Schema version changes (breaking changes to `SemanticIndex` structure)
- Language config changes (tree-sitter query updates)

**Registry population:**
When loading from cache, registries are populated the same way as fresh indexing:
```typescript
// All registries already support incremental updates
definition_registry.add_definitions_from_file(semantic_index)
scope_registry.add_scopes_from_file(semantic_index)
type_registry.update_file(file_path, semantic_index, ...)
// etc.
```

### 3. Resolution Cache

**What:** Cache name and call resolution results
**Input:** File content hash + dependency export hashes
**Output:** Scope resolutions + call resolutions
**Cost saved:** 10-150ms per file (depends on import fan-out)
**Storage:** Fully serializable, can persist

```typescript
interface ResolutionCache {
  // Name resolutions (phase 1)
  key: (file_path: FilePath, content_hash: string, dependency_hashes: Map<FilePath, string>) => string
  value: {
    resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>>,
    dependency_snapshot: Map<FilePath, string>  // For invalidation detection
  }

  // Call resolutions (phase 2)
  key: (file_path: FilePath, content_hash: string, type_registry_hash: string, dependency_hashes: Map<FilePath, string>) => string
  value: {
    calls_by_file: Map<FilePath, CallReference[]>,
    calls_by_scope: Map<ScopeId, CallReference[]>,
    dependency_snapshot: Map<FilePath, string>,
    type_snapshot: string  // Hash of relevant type bindings
  }

  invalidation: content changes OR dependency export changes OR type changes
  persistence: disk-persistable
}
```

**Dependency tracking for invalidation:**
```typescript
// For each file, track the hash of what it imports
{
  file_path: "src/app.ts",
  content_hash: "abc123",
  dependency_hashes: {
    "src/utils.ts": "def456",      // Only exports matter
    "src/types.ts": "ghi789",
    "node_modules/lodash": "cached_stdlib"  // Stable hash for stdlib
  }
}
```

**Invalidation triggers:**
- File content changes (own file)
- Dependency export changes (any imported file's exports change)
- Type registry changes (for call resolution only)
- Transitive invalidation via ImportGraph

**Smart invalidation:**
```typescript
// Only invalidate if exported symbols actually changed
function should_invalidate_dependents(
  file_path: FilePath,
  old_semantic_index: SemanticIndex,
  new_semantic_index: SemanticIndex
): boolean {
  const old_exports = get_exported_symbols(old_semantic_index)
  const new_exports = get_exported_symbols(new_semantic_index)
  return !exports_equal(old_exports, new_exports)
}
```

This avoids cascading re-resolution when a file's internal implementation changes but exports remain stable.

## Cache Provider Interface

```typescript
/**
 * Pluggable cache backend interface.
 * Users can implement custom providers (SQLite, Redis, filesystem, etc.)
 */
interface CacheProvider {
  // Basic operations
  get<T>(namespace: CacheNamespace, key: string): Promise<T | null>
  set<T>(namespace: CacheNamespace, key: string, value: T): Promise<void>
  delete(namespace: CacheNamespace, key: string): Promise<void>
  clear(namespace: CacheNamespace): Promise<void>

  // Batch operations (for efficiency)
  get_many<T>(namespace: CacheNamespace, keys: string[]): Promise<Map<string, T>>
  set_many<T>(namespace: CacheNamespace, entries: Map<string, T>): Promise<void>
  delete_many(namespace: CacheNamespace, keys: string[]): Promise<void>

  // Lifecycle
  close(): Promise<void>
}

/**
 * Cache namespaces for isolation
 */
type CacheNamespace =
  | 'parse_trees'          // Parser.Tree objects (in-memory only)
  | 'semantic_indexes'     // SemanticIndex per file
  | 'name_resolutions'     // Scope → Name → SymbolId mappings
  | 'call_resolutions'     // Resolved call references
  | 'metadata'             // Schema versions, configuration

/**
 * Cache key generators
 */
interface CacheKeyGenerator {
  parse_tree_key(file_path: FilePath, content_hash: string, language: Language): string
  semantic_index_key(file_path: FilePath, content_hash: string, schema_version: string): string
  name_resolution_key(file_path: FilePath, content_hash: string, dep_hashes: Map<FilePath, string>): string
  call_resolution_key(file_path: FilePath, content_hash: string, dep_hashes: Map<FilePath, string>, type_hash: string): string
}
```

## Default In-Memory Provider

```typescript
/**
 * Default cache provider using in-memory Maps with LRU eviction.
 * No persistence across sessions, but zero external dependencies.
 */
class InMemoryCacheProvider implements CacheProvider {
  private caches: Map<CacheNamespace, LRUCache<string, any>>

  constructor(options: {
    max_size_mb?: number  // Default: 512 MB
    ttl_seconds?: number  // Default: 3600 (1 hour)
  }) {
    this.caches = new Map()
    // Initialize LRU cache per namespace
  }

  // Implementation uses simple Map with LRU eviction
  // Tracks memory usage and evicts oldest entries when limit reached
}
```

## Integration with Project Class

```typescript
interface ProjectOptions {
  cache_provider?: CacheProvider  // Optional, defaults to InMemoryCacheProvider
  cache_config?: {
    enable_parse_cache: boolean          // Default: true
    enable_semantic_index_cache: boolean // Default: true
    enable_resolution_cache: boolean     // Default: true
    schema_version: string               // For cache invalidation on breaking changes
  }
}

class Project {
  private cache: CacheProvider
  private cache_config: CacheConfig

  constructor(options: ProjectOptions) {
    this.cache = options.cache_provider ?? new InMemoryCacheProvider()
    this.cache_config = options.cache_config ?? default_cache_config
  }

  async update_file(file_path: FilePath, content: string): Promise<void> {
    const content_hash = hash_content(content)

    // Phase 1: Try parse cache
    let tree = await this.try_parse_cache(file_path, content_hash, language)
    if (!tree) {
      tree = this.parse(content, language)
      await this.cache.set('parse_trees', parse_key, tree)
    }

    // Phase 2: Try semantic index cache
    let semantic_index = await this.try_semantic_index_cache(file_path, content_hash)
    if (!semantic_index) {
      semantic_index = build_semantic_index(parsed_file)
      await this.cache.set('semantic_indexes', semantic_index_key, semantic_index)
    }

    // Phase 3: Populate registries (always needed, registries are in-memory)
    this.populate_registries(file_path, semantic_index)

    // Phase 4: Try resolution cache
    const dependency_hashes = await this.compute_dependency_hashes(file_path)
    let resolutions = await this.try_resolution_cache(file_path, content_hash, dependency_hashes)

    if (!resolutions) {
      // Re-resolve this file + dependents
      const affected_files = this.import_graph.get_affected_files(file_path)
      resolutions = await this.resolve_all(affected_files)

      // Cache each file's resolutions
      for (const [file, resolution] of resolutions) {
        await this.cache.set('name_resolutions', resolution_key(file), resolution)
      }
    }
  }

  private async compute_dependency_hashes(file_path: FilePath): Promise<Map<FilePath, string>> {
    const dependencies = this.import_graph.get_dependencies(file_path)
    const hashes = new Map<FilePath, string>()

    for (const dep of dependencies) {
      // Hash only the exported symbols (not the entire file)
      const export_metadata = this.export_registry.get_exports(dep)
      const export_hash = hash_exports(export_metadata)
      hashes.set(dep, export_hash)
    }

    return hashes
  }
}
```

## Cache Invalidation Strategy

### File Update Flow

```
1. File A changes
   ↓
2. Invalidate caches for File A:
   - parse_trees/A
   - semantic_indexes/A
   - name_resolutions/A
   - call_resolutions/A
   ↓
3. Compute new export hash for File A
   ↓
4. Find dependents: ImportGraph.get_dependents(A)
   ↓
5. For each dependent D:
   - Check if A's export hash changed
   - If changed: invalidate resolutions/D (but NOT semantic_index/D)
   - Mark D for re-resolution
   ↓
6. Re-resolve all affected files
   ↓
7. Cache new resolutions
```

### Smart Export-Based Invalidation

Only invalidate dependents when exports actually change:

```typescript
async update_file(file_path: FilePath, content: string): Promise<void> {
  // Get old export signature
  const old_exports = this.export_registry.get_export_metadata(file_path)
  const old_export_hash = hash_exports(old_exports)

  // Update file (rebuild semantic index)
  const new_semantic_index = await this.index_file(file_path, content)

  // Get new export signature
  const new_exports = extract_exports(new_semantic_index)
  const new_export_hash = hash_exports(new_exports)

  // Only invalidate dependents if exports changed
  if (old_export_hash !== new_export_hash) {
    const dependents = this.import_graph.get_dependents(file_path)
    await this.invalidate_resolutions(dependents)
  }
}
```

### Transitive Invalidation

```typescript
// Example: A imports B imports C
// If C's exports change:
//   - Invalidate B's resolutions (direct dependent)
//   - If B's exports change as a result (re-exports from C):
//     - Invalidate A's resolutions (transitive dependent)
//   - If B's exports don't change:
//     - A's cache remains valid!
```

This prevents unnecessary re-resolution of the entire dependency graph.

## Performance Targets

### Cache Hit Rates (Expected)

| Scenario | Parse Cache | Semantic Index Cache | Resolution Cache |
|----------|-------------|---------------------|------------------|
| No file changes | 100% | 100% | 100% |
| Single file edit (no export changes) | 95%+ | 95%+ | 90%+ |
| Single file edit (with export changes) | 95%+ | 95%+ | 70-90% |
| Multiple related files | 90%+ | 90%+ | 60-80% |

### Typical Speedups

| Operation | Without Cache | With Cache | Speedup |
|-----------|---------------|------------|---------|
| Re-index unchanged file | 15-50ms | < 1ms | 15-50x |
| Re-index changed file (no dep changes) | 25-175ms | 10-50ms | 2-3x |
| Large project initial load | N/A | 10-100x (session restore) | - |

### Memory Usage

- Parse cache: ~500KB per file (tree-sitter trees)
- Semantic index cache: ~100-500KB per file (serialized)
- Resolution cache: ~50-200KB per file
- Total for 100 files: ~50-100 MB (well within default limit)

## Implementation Plan

### Phase 1: Foundation (task-160.1)
- Define `CacheProvider` interface
- Define cache key generation functions
- Define serialization format for cached data
- Add `schema_version` tracking to invalidate on breaking changes

### Phase 2: In-Memory Provider (task-160.2)
- Implement `InMemoryCacheProvider` with LRU eviction
- Add memory usage tracking
- Add TTL support
- Add unit tests for all operations

### Phase 3: Parse Cache Integration (task-160.3)
- Integrate parse cache into `Project.update_file()`
- Add content hashing (SHA-256 or similar)
- Add cache hit/miss metrics
- Test with real codebases

### Phase 4: Semantic Index Cache (task-160.4)
- Integrate semantic index cache
- Add schema version checking
- Add serialization/deserialization for `SemanticIndex`
- Test cache invalidation on schema changes

### Phase 5: Resolution Cache (task-160.5)
- Integrate name resolution cache
- Integrate call resolution cache
- Implement dependency hash computation
- Implement smart export-based invalidation
- Test transitive invalidation scenarios

### Phase 6: Example Disk Provider (task-160.6)
- Implement example `DiskCacheProvider` using filesystem
- Use MessagePack or JSON for serialization
- Include error handling and recovery
- Document usage and configuration

### Phase 7: Documentation & Optimization (task-160.7)
- Document cache provider interface
- Document cache invalidation semantics
- Add performance benchmarks
- Tune LRU sizes and eviction policies
- Add cache statistics API

## Testing Requirements

### Unit Tests
- Cache provider interface compliance tests
- LRU eviction correctness
- Memory limit enforcement
- TTL expiration
- Serialization roundtrip (SemanticIndex, Resolutions)

### Integration Tests
- Cache hit/miss behavior
- Invalidation on file changes
- Smart export-based invalidation
- Transitive dependency invalidation
- Cross-file resolution with caching

### Performance Tests
- Measure cache hit rates on real codebases
- Measure speedup for incremental updates
- Measure memory usage under load
- Compare cached vs non-cached throughput

## Cache Key Format

```typescript
// Example keys (for clarity and debuggability)
const parse_key = `parse:${file_path}:${content_hash}:${language}`
const semantic_key = `semantic:${file_path}:${content_hash}:${schema_version}`
const name_resolution_key = `name_res:${file_path}:${content_hash}:${deps_hash}`
const call_resolution_key = `call_res:${file_path}:${content_hash}:${deps_hash}:${type_hash}`
```

Keys are designed to be:
- Human-readable (for debugging)
- Deterministic (same inputs → same key)
- Collision-resistant (include all relevant factors)

## Future Enhancements

### Potential Optimizations
1. **Incremental parsing**: Tree-sitter supports incremental parsing, could reduce parse time further
2. **Bloom filters**: Fast negative lookups for cache misses
3. **Compression**: Compress cached data (especially for disk storage)
4. **Partial invalidation**: Invalidate only affected scopes, not entire file
5. **Parallel resolution**: Resolve independent files in parallel

### External Cache Providers (User Implementations)
- SQLite backend (persistent, single-user)
- Redis backend (distributed, multi-user)
- Filesystem backend (simple, debuggable)
- IndexedDB (browser environments)

## Acceptance Criteria

- [ ] `CacheProvider` interface defined with full documentation
- [ ] `InMemoryCacheProvider` implemented with LRU and memory limits
- [ ] Parse cache integrated and tested
- [ ] Semantic index cache integrated and tested
- [ ] Resolution cache integrated with smart invalidation
- [ ] Cache hit rates > 90% for unchanged files
- [ ] Cache hit rates > 70% for files with local changes only
- [ ] Memory usage stays within configured limits
- [ ] Example disk-based provider implemented
- [ ] Full documentation for cache provider API
- [ ] Performance benchmarks demonstrate 10x+ speedup for incremental updates

## Related Tasks

- task-26.1: Define storage interface and types (generic storage, not caching)
- task-26.2: Implement default in-memory storage provider (registries, not cache)
- task-26.3: Create example disk-based storage provider (registries, not cache)

Note: Tasks 26.x focus on persistent storage of registries (full project state). This task focuses on caching intermediate results for performance (parse trees, semantic indexes, resolutions). Both are complementary.
