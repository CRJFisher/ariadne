---
id: task-160
title: Implement caching system for semantic indexing and resolution
status: To Do
assignee: []
created_date: '2025-11-24'
labels: [performance, architecture]
dependencies: []
---

## Overview

Add caching for semantic indexes and resolutions to improve performance on project reload and incremental updates. The system uses a pluggable cache provider interface, allowing users to implement custom backends (SQLite, filesystem, etc.) while providing an in-memory default.

**Goal:** When a project is reloaded with few or no file changes, startup should be near-instant by loading cached data instead of re-processing everything.

## Architecture

### Two Cache Layers

```
File Content → [Semantic Index Cache] → SemanticIndex → [Resolution Cache] → Resolved Calls
                     ↓                                        ↓
                 Expensive                                Moderate
                (10-50ms/file)                          (2-10ms/file)
```

### 1. Semantic Index Cache

Caches the result of parsing and indexing a file (definitions, references, scopes).

```typescript
interface SemanticIndexCacheEntry {
  content_hash: string           // SHA-256 of file content
  schema_version: string         // For cache invalidation on breaking changes
  semantic_index: SerializedSemanticIndex
}
```

**Key:** `file_path`
**Invalidation:** `content_hash` mismatch OR `schema_version` mismatch

### 2. Resolution Cache

Caches name and call resolutions for a file.

```typescript
interface ResolutionCacheEntry {
  content_hash: string           // SHA-256 of file content
  schema_version: string
  name_resolutions: SerializedNameResolutions    // Map<ScopeId, Map<SymbolName, SymbolId>>
  call_resolutions: SerializedCallReferences     // CallReference[]
}
```

**Key:** `file_path`
**Invalidation:** `content_hash` mismatch OR file depends on a changed file

## Update Strategy

The same logic applies to both incremental updates (runtime) and project reload (cold start).

### Core Algorithm

```typescript
function update_project(changed_files: Set<FilePath>, all_files: Set<FilePath>) {
  // Phase 1: Compute affected files
  const affected_files = new Set<FilePath>()
  for (const changed_file of changed_files) {
    affected_files.add(changed_file)
    for (const dependent of import_graph.get_dependents(changed_file)) {
      affected_files.add(dependent)
    }
  }

  // Phase 2: Update semantic indexes
  for (const file of all_files) {
    if (changed_files.has(file)) {
      // File changed: re-index and cache
      const semantic_index = build_semantic_index(file)
      cache.set('semantic_indexes', file, { content_hash, schema_version, semantic_index })
      populate_registries(file, semantic_index)
    } else {
      // File unchanged: load from cache
      const cached = cache.get('semantic_indexes', file)
      populate_registries(file, cached.semantic_index)
    }
  }

  // Phase 3: Update resolutions
  for (const file of all_files) {
    if (affected_files.has(file)) {
      // File affected: re-resolve and cache
      resolve_file(file)
      cache.set('resolutions', file, { content_hash, schema_version, resolutions })
    } else {
      // File unaffected: load from cache
      const cached = cache.get('resolutions', file)
      load_resolutions(file, cached)
    }
  }
}
```

### On Incremental File Change (Runtime)

When a single file is edited:

```
1. changed_files = {F}
2. affected_files = {F} ∪ dependents(F)

3. For changed file F:
   - Re-index F, update semantic index cache
   - Re-resolve F, update resolution cache

4. For each dependent D in affected_files (excluding F):
   - Semantic index cache remains VALID (D's content unchanged)
   - Re-resolve D, update resolution cache
```

**Example:** File `utils.ts` is edited, and `app.ts` imports from it.
- Re-index: `utils.ts` only (1 file)
- Re-resolve: `utils.ts` + `app.ts` (2 files)

### On Project Load (Cold Start)

When loading a project with cached data:

```
Phase 1: Determine Changed Files
  changed_files = {}
  for each file F in project:
    cached = cache.get('semantic_indexes', F)
    if !cached OR cached.content_hash != current_hash(F) OR cached.schema_version != SCHEMA_VERSION:
      changed_files.add(F)

Phase 2: Compute Affected Files
  affected_files = {}
  for each changed_file C:
    affected_files.add(C)
    for each dependent D of C:
      affected_files.add(D)

Phase 3: Load/Index Semantic Indexes
  for each file F:
    if F in changed_files:
      index F fresh, update cache
    else:
      load semantic index from cache

Phase 4: Load/Resolve Resolutions
  for each file F:
    if F in affected_files:
      resolve F fresh, update cache
    else:
      load resolutions from cache
```

**Result:**
- 0 files changed: load everything from cache (sub-second startup)
- 1 file changed: re-index 1 file, re-resolve that file + dependents
- All files changed: full re-processing (same as fresh start)

## Cache Provider Interface

```typescript
/**
 * Pluggable cache backend interface.
 * Users can implement custom providers (SQLite, filesystem, Redis, etc.)
 */
interface CacheProvider {
  get<T>(namespace: string, key: string): Promise<T | null>
  set<T>(namespace: string, key: string, value: T): Promise<void>
  delete(namespace: string, key: string): Promise<void>
  clear(namespace: string): Promise<void>

  // Batch operations for efficiency
  get_many<T>(namespace: string, keys: string[]): Promise<Map<string, T>>
  set_many<T>(namespace: string, entries: Map<string, T>): Promise<void>

  // Lifecycle
  close(): Promise<void>
}

type CacheNamespace = 'semantic_indexes' | 'resolutions' | 'metadata'
```

## Default In-Memory Provider

```typescript
/**
 * Default cache provider using in-memory Maps with LRU eviction.
 * No persistence across process restarts, but zero external dependencies.
 */
class InMemoryCacheProvider implements CacheProvider {
  private caches: Map<string, LRUCache<string, unknown>>

  constructor(options?: {
    max_entries?: number  // Default: 1000 per namespace
    max_size_mb?: number  // Default: 256 MB total
  })
}
```

## Serialization

Semantic indexes and resolutions use TypeScript Maps and branded types (SymbolId, ScopeId) that need serialization:

```typescript
// Serialize Map<K, V> → Array<[K, V]>
// Deserialize Array<[K, V]> → Map<K, V>

interface SerializedSemanticIndex {
  file_path: string
  language: string
  root_scope_id: string
  scopes: Array<[string, SerializedLexicalScope]>
  functions: Array<[string, FunctionDefinition]>
  classes: Array<[string, ClassDefinition]>
  // ... other definition types
  references: SymbolReference[]
}

interface SerializedNameResolutions {
  resolutions_by_scope: Array<[string, Array<[string, string]>]>  // ScopeId → (Name → SymbolId)
}

interface SerializedCallReferences {
  calls: CallReference[]
}
```

## Implementation Phases

### Phase 1: Cache Interface and Types (task-160.1)
- Define `CacheProvider` interface
- Define `SemanticIndexCacheEntry`, `ResolutionCacheEntry` types
- Define `SCHEMA_VERSION` constant
- Add content hashing utility (`hash_content(content: string): string`)

### Phase 2: Serialization (task-160.2)
- Implement `serialize_semantic_index()` / `deserialize_semantic_index()`
- Implement `serialize_resolutions()` / `deserialize_resolutions()`
- Handle Map/Set serialization to arrays
- Handle branded types (SymbolId, ScopeId, FilePath)
- Roundtrip tests

### Phase 3: In-Memory Cache Provider (task-160.3)
- Implement `InMemoryCacheProvider`
- LRU eviction with configurable limits
- Batch operations (`get_many`, `set_many`)
- Unit tests

### Phase 4: Project Integration (task-160.4)
- Add optional `cache_provider` to `ProjectOptions`
- Implement cache-aware `load_project()` method
- Modify `update_file()` to update cache
- Track changed files during load
- Compute affected files using `ImportGraph.get_dependents()`
- Integration tests for incremental and cold start scenarios

### Phase 5: Example Disk Provider (task-160.5)
- Implement `FileSystemCacheProvider` as example
- Store as JSON files in `.ariadne-cache/` directory
- Handle file locking, error recovery
- Document how users can implement custom providers

## Files to Create/Modify

**New files:**
- `packages/core/src/cache/cache_provider.ts` - Interface and types
- `packages/core/src/cache/in_memory_cache.ts` - Default implementation
- `packages/core/src/cache/serialization.ts` - Serialize/deserialize functions
- `packages/core/src/cache/index.ts` - Barrel exports
- `packages/core/src/cache/filesystem_cache.ts` - Example disk provider

**Modified files:**
- `packages/core/src/project/project.ts` - Cache integration
- `packages/core/src/index.ts` - Export cache types
- `packages/types/src/index.ts` - Export cache entry types (if needed)

## Expected Performance

| Scenario | Before | After |
|----------|--------|-------|
| Cold start, 0 files changed | ~10s (100 files) | < 1s |
| Cold start, 1 file changed | ~10s | ~1-2s |
| Cold start, 10 files changed | ~10s | ~2-4s |
| Incremental edit (runtime) | ~50-200ms | ~50-200ms (same) |

**Key insight:** The main win is cold start / project reload. Incremental updates during a session remain the same speed, which is acceptable since they're already fast enough.

## Testing Requirements

### Unit Tests
- `CacheProvider` interface compliance
- LRU eviction correctness
- Serialization roundtrip for all cached types
- Content hashing consistency

### Integration Tests
- Cold start with full cache hit
- Cold start with partial cache hit (some files changed)
- Incremental update invalidates correct caches
- Dependent file resolution cache invalidation
- Schema version mismatch triggers full rebuild

### Performance Tests
- Measure startup time with/without cache
- Measure cache hit rates
- Memory usage of in-memory cache

## Acceptance Criteria

- [ ] `CacheProvider` interface defined
- [ ] `InMemoryCacheProvider` implemented with LRU
- [ ] Semantic index cache integrated and tested
- [ ] Resolution cache integrated and tested
- [ ] Cold start with 0 changes loads from cache (< 1s for 100 files)
- [ ] Incremental update correctly invalidates dependents
- [ ] Example `FileSystemCacheProvider` implemented
- [ ] Documentation for custom cache providers

## Sub-Tasks

- task-160.1: Cache interface and types
- task-160.2: Serialization
- task-160.3: In-memory cache provider
- task-160.4: Project integration
- task-160.5: Example disk provider
